import { DEFAULT_TZ, todayLocal } from '../domain/dates';
import { routineSequence } from '../domain/sequence';
import type { ID, SessionExercise, SetLog, WorkoutSession } from '../domain/types';
import { db, nowIso } from './db';
import { adaptationFor, createProgram, plannedExercisesFor } from './program';
import { ActiveSessionExistsError, startSession } from './sessions';
import { ROUTINE_TEMPLATE } from './seed/routine';
import { upgradeRoutine } from './routine-upgrade';

/**
 * Lecturas y acciones de alto nivel para la interfaz simple: un solo usuario, un solo gimnasio
 * y una rutina fija. No hay configuración inicial: el programa se crea solo.
 */

/**
 * Si no hay programa activo, lo crea y da el perfil por configurado. Empieza en la fecha local
 * actual: la secuencia de días no necesita esperar un lunes ni una fecha del calendario.
 */
export async function ensureProgram(): Promise<void> {
  await db.transaction('rw', [db.programs, db.scheduledWorkouts, db.routineTemplates, db.profile], async () => {
    if (await db.programs.where('status').equals('active').first()) return;
    const profile = await db.profile.get('me');
    const timeZone = profile?.timeZone ?? DEFAULT_TZ;
    const template = (await db.routineTemplates.get(ROUTINE_TEMPLATE.id)) ?? (await db.routineTemplates.filter((t) => !t.archived).first());
    if (!template) return;
    const today = todayLocal(timeZone);
    await createProgram({ templateId: template.id, startDate: today, timeZone });
    if (profile && !profile.onboardedAt) await db.profile.update('me', { onboardedAt: nowIso(), updatedAt: nowIso() });
  });
}

/**
 * Inicia únicamente el siguiente día de la secuencia. La última sesión completa determina
 * cuál sigue; las parciales, ausencias y fechas planificadas no adelantan la rutina.
 * La validación y la creación comparten transacción para proteger otra pestaña o importación.
 */
export async function startDay(dayId: ID, timeZone: string): Promise<WorkoutSession> {
  await upgradeRoutine();
  return db.transaction('rw', [
    db.programs, db.routineTemplates, db.programDecisions, db.sessions, db.sessionExercises,
    db.setLogs, db.scheduledWorkouts, db.variants, db.equipment, db.meta,
  ], async () => {
    const active = await db.sessions.where('status').equals('active').first();
    if (active) throw new ActiveSessionExistsError(active.id);
    const program = await db.programs.where('status').equals('active').first();
    const template = program ? await db.routineTemplates.get(program.templateId) : undefined;
    if (!program || !template || template.archived) throw new Error('No hay una rutina activa.');
    const sequence = routineSequence(program.id, template.days, await db.sessions.toArray());
    const day = template.days.find((d) => d.id === sequence.nextDayId);
    if (!day) throw new Error('La rutina no tiene días de entrenamiento.');
    if (dayId !== day.id) throw new Error(`Primero completa el Día ${sequence.nextDayNumber}: ${day.name}.`);
    const adaptation = await adaptationFor(program, template, todayLocal(timeZone));
    return startSession({
      programId: program.id,
      scheduledWorkoutId: null,
      dayId: day.id,
      title: day.name,
      timeZone,
      programWeek: null,
      adaptation: adaptation.active,
      exercises: plannedExercisesFor(day, template, adaptation.active),
    });
  });
}

export interface LastPerformance {
  date: string;
  sets: SetLog[];
  /** Repeticiones máximas prescritas en esa sesión (para sugerir subir peso). */
  repMax: number;
}

/** Última sesión registrada de cada variante (series de trabajo confirmadas, en orden). */
export async function lastPerformanceByVariant(variantIds: ID[], excludeSessionId?: ID): Promise<Map<ID, LastPerformance>> {
  const out = new Map<ID, LastPerformance>();
  const sessions = new Map((await db.sessions.where('status').anyOf('completed', 'partial').toArray()).map((s) => [s.id, s]));
  for (const variantId of new Set(variantIds)) {
    const candidates = (await db.sessionExercises.where('variantId').equals(variantId).toArray())
      .filter((se) => se.sessionId !== excludeSessionId && sessions.has(se.sessionId))
      .sort((a, b) => (sessions.get(b.sessionId)!.startedAt < sessions.get(a.sessionId)!.startedAt ? -1 : 1));
    for (const se of candidates) {
      const sets = await completedWorkSets(se);
      if (sets.length === 0) continue;
      out.set(variantId, { date: sessions.get(se.sessionId)!.localDate, sets, repMax: se.prescribed.repMax });
      break;
    }
  }
  return out;
}

async function completedWorkSets(se: SessionExercise): Promise<SetLog[]> {
  return (await db.setLogs.where('sessionExerciseId').equals(se.id).toArray())
    .filter((s) => s.kind === 'work' && s.status === 'completed' && s.deletedAt === null)
    .sort((a, b) => a.order - b.order);
}

export interface SessionSummary {
  session: WorkoutSession;
  exercises: { se: SessionExercise; sets: SetLog[] }[];
  doneSets: number;
}

/** Sesión con sus ejercicios y series confirmadas, para el historial. */
export async function sessionSummary(sessionId: ID): Promise<SessionSummary | null> {
  const session = await db.sessions.get(sessionId);
  if (!session) return null;
  const ses = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
  const exercises = await Promise.all(ses.map(async (se) => ({ se, sets: await completedWorkSets(se) })));
  return { session, exercises, doneSets: exercises.reduce((n, e) => n + e.sets.length, 0) };
}
