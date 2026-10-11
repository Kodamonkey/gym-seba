import { isoWeekday, todayLocal } from '../domain/dates';
import {
  adaptationState,
  effectivePrescription,
  programWeek,
  recurrenceDates,
  type AdaptationState,
} from '../domain/schedule';
import type {
  ID,
  LocalDate,
  Program,
  ProgramDecisionKind,
  RoutineDay,
  RoutineTemplate,
  ScheduledWorkout,
  WorkoutSession,
} from '../domain/types';
import { db, nowIso, uid } from './db';
import { startSession, type PlannedExerciseInput } from './sessions';

/** Programas, calendario y adaptación. */

export async function getActiveProgram(): Promise<Program | undefined> {
  return db.programs.where('status').equals('active').first();
}

export async function getTemplate(id: ID): Promise<RoutineTemplate | undefined> {
  return db.routineTemplates.get(id);
}

function scheduled(programId: ID, dayId: ID, date: LocalDate, origin: 'rule' | 'manual', now: string): ScheduledWorkout {
  return { id: uid(), programId, dayId, date, movedFrom: null, origin, skippedConfirmed: false, sessionId: null, createdAt: now, updatedAt: now };
}

export interface CreateProgramInput {
  templateId: ID;
  startDate: LocalDate;
  timeZone: string;
  weekdays?: Record<ID, number>;
}

/** Crea el programa y materializa sus sesiones planificadas. Archiva el programa activo anterior. */
export async function createProgram(input: CreateProgramInput): Promise<Program> {
  const template = await db.routineTemplates.get(input.templateId);
  if (!template) throw new Error('Plantilla no encontrada.');
  const now = nowIso();
  const weekdays = input.weekdays ?? Object.fromEntries(template.days.map((d) => [d.id, d.weekday]));
  const program: Program = {
    id: uid(),
    templateId: template.id,
    name: template.name,
    startDate: input.startDate,
    weeks: template.weeksTotal,
    adaptationWeeks: template.adaptation.weeks,
    timeZone: input.timeZone,
    weekdays,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  };
  await db.transaction('rw', [db.programs, db.scheduledWorkouts], async () => {
    const actives = await db.programs.where('status').equals('active').toArray();
    for (const p of actives) await db.programs.update(p.id, { status: 'archived', updatedAt: now });
    await db.programs.add(program);
    const dates = recurrenceDates(program, template.days.map((d) => d.id));
    await db.scheduledWorkouts.bulkAdd(dates.map((d) => scheduled(program.id, d.dayId, d.date, 'rule', now)));
  });
  return program;
}

export async function moveScheduledWorkout(swId: ID, newDate: LocalDate): Promise<void> {
  await db.transaction('rw', db.scheduledWorkouts, async () => {
    const sw = await db.scheduledWorkouts.get(swId);
    if (!sw) return;
    if (sw.sessionId) throw new Error('Esta sesión ya tiene un registro: no se puede mover.');
    await db.scheduledWorkouts.put({
      ...sw,
      date: newDate,
      movedFrom: sw.movedFrom ?? sw.date,
      skippedConfirmed: false,
      updatedAt: nowIso(),
    });
  });
}

export async function setSkipped(swId: ID, skipped: boolean): Promise<void> {
  await db.scheduledWorkouts.update(swId, { skippedConfirmed: skipped, updatedAt: nowIso() });
}

export async function addManualWorkout(programId: ID, dayId: ID, date: LocalDate): Promise<ID> {
  const sw = scheduled(programId, dayId, date, 'manual', nowIso());
  await db.scheduledWorkouts.add(sw);
  return sw.id;
}

export async function deleteScheduledWorkout(swId: ID): Promise<void> {
  const sw = await db.scheduledWorkouts.get(swId);
  if (sw?.sessionId) throw new Error('No se puede eliminar una sesión planificada que ya tiene registro.');
  await db.scheduledWorkouts.delete(swId);
}

/**
 * Cambia el día de la semana de una sesión recurrente.
 * - 'only-this': mueve solo esa instancia.
 * - 'this-and-future': cambia la regla y regenera las futuras sin registro (no toca las realizadas).
 */
export async function changeRecurrence(
  swId: ID,
  newDate: LocalDate,
  scope: 'only-this' | 'this-and-future',
): Promise<void> {
  const sw = await db.scheduledWorkouts.get(swId);
  if (!sw) return;
  if (scope === 'only-this') return moveScheduledWorkout(swId, newDate);

  await db.transaction('rw', [db.programs, db.scheduledWorkouts], async () => {
    const program = await db.programs.get(sw.programId);
    if (!program) return;
    const weekday = isoWeekday(newDate);
    const now = nowIso();
    const updated: Program = { ...program, weekdays: { ...program.weekdays, [sw.dayId]: weekday }, updatedAt: now };
    await db.programs.put(updated);

    const future = (await db.scheduledWorkouts.where('programId').equals(program.id).toArray()).filter(
      (x) => x.dayId === sw.dayId && x.date >= sw.date && x.sessionId === null && x.origin === 'rule',
    );
    await db.scheduledWorkouts.bulkDelete(future.map((x) => x.id));
    const from = newDate < sw.date ? newDate : sw.date;
    const regenerated = recurrenceDates({ ...updated, startDate: program.startDate }, [sw.dayId]).filter((d) => d.date >= from);
    const taken = new Set(
      (await db.scheduledWorkouts.where('programId').equals(program.id).toArray())
        .filter((x) => x.dayId === sw.dayId)
        .map((x) => x.date),
    );
    await db.scheduledWorkouts.bulkAdd(
      regenerated.filter((d) => !taken.has(d.date)).map((d) => scheduled(program.id, d.dayId, d.date, 'rule', now)),
    );
  });
}

export async function recordDecision(programId: ID, kind: ProgramDecisionKind, detail: string): Promise<void> {
  await db.programDecisions.add({ id: uid(), programId, kind, detail, createdAt: nowIso() });
}

/** Mantener la adaptación: la extiende hasta el final de la semana de programa en curso (o la siguiente). */
export async function keepAdaptation(program: Program, today: LocalDate, extraWeeks = 1): Promise<void> {
  const week = programWeek(program.startDate, today);
  const newWeeks = Math.max(program.adaptationWeeks, week - 1) + extraWeeks;
  await db.programs.update(program.id, { adaptationWeeks: newWeeks, updatedAt: nowIso() });
  await recordDecision(program.id, 'keep-adaptation', `Adaptación extendida hasta la semana ${newWeeks}.`);
}

export async function endAdaptation(program: Program): Promise<void> {
  await recordDecision(program.id, 'end-adaptation', 'El usuario decidió terminar la adaptación.');
}

export async function adaptationFor(program: Program, template: RoutineTemplate, today: LocalDate): Promise<AdaptationState> {
  const sessions = await db.sessions.where('status').anyOf('completed', 'partial').toArray();
  const decisions = await db.programDecisions.where('programId').equals(program.id).toArray();
  return adaptationState({
    program,
    daysPerWeek: template.days.length,
    today,
    completedDates: sessions.filter((s) => s.programId === program.id).map((s) => s.localDate),
    decisions,
  });
}

export function plannedExercisesFor(day: RoutineDay, template: RoutineTemplate, adaptation: boolean): PlannedExerciseInput[] {
  return day.exercises.map((ex) => ({ slotId: ex.id, variantId: ex.variantId, prescription: effectivePrescription(ex, adaptation, template) }));
}

/** Inicia la sesión de una planificada (o libre si no hay programa). */
export async function startScheduledWorkout(swId: ID, timeZone: string): Promise<WorkoutSession> {
  const sw = await db.scheduledWorkouts.get(swId);
  if (!sw) throw new Error('Sesión planificada no encontrada.');
  const program = await db.programs.get(sw.programId);
  if (!program) throw new Error('Programa no encontrado.');
  const template = await db.routineTemplates.get(program.templateId);
  const day = template?.days.find((d) => d.id === sw.dayId);
  if (!template || !day) throw new Error('El día de la rutina ya no existe en la plantilla.');
  const today = todayLocal(timeZone);
  const adaptation = await adaptationFor(program, template, today);
  return startSession({
    programId: program.id,
    scheduledWorkoutId: sw.id,
    dayId: day.id,
    title: day.name,
    timeZone,
    programWeek: programWeek(program.startDate, today),
    adaptation: adaptation.active,
    exercises: plannedExercisesFor(day, template, adaptation.active),
  });
}

/** Sesión libre a partir de un día de la plantilla, sin vínculo con el calendario. */
export async function startFreeWorkout(templateId: ID, dayId: ID, timeZone: string, adaptation: boolean): Promise<WorkoutSession> {
  const template = await db.routineTemplates.get(templateId);
  const day = template?.days.find((d) => d.id === dayId);
  if (!template || !day) throw new Error('Día no encontrado.');
  const program = await getActiveProgram();
  const today = todayLocal(timeZone);
  return startSession({
    programId: program?.id ?? null,
    scheduledWorkoutId: null,
    dayId,
    title: day.name,
    timeZone,
    programWeek: program ? programWeek(program.startDate, today) : null,
    adaptation,
    exercises: plannedExercisesFor(day, template, adaptation),
  });
}

/** Guarda una edición de la plantilla como nueva versión. Las sesiones pasadas no cambian (tienen su copia). */
export async function saveTemplate(next: RoutineTemplate): Promise<RoutineTemplate> {
  return db.transaction('rw', [db.routineTemplates, db.routineVersions], async () => {
    const current = await db.routineTemplates.get(next.id);
    const version = (current?.version ?? 0) + 1;
    const saved: RoutineTemplate = { ...next, version, updatedAt: nowIso() };
    await db.routineTemplates.put(saved);
    await db.routineVersions.add({ id: `${saved.id}@${version}`, templateId: saved.id, version, snapshot: saved, createdAt: nowIso() });
    return saved;
  });
}

