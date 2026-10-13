import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program, RoutineTemplate } from '../domain/types';
import { db } from './db';
import { adaptationFor, createProgram, endAdaptation, keepAdaptation } from './program';
import { ensureSeeded } from './seed';
import { confirmSet, finishSession, liveSetsOf, startSession } from './sessions';

let program: Program;
let template: RoutineTemplate;

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
  program = await createProgram({ templateId: 'rt-atlas-4d', startDate: '2026-10-12', timeZone: 'America/Santiago' });
  template = (await db.routineTemplates.get(program.templateId))!;
  vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => vi.useRealTimers());

async function record(date: string, status: 'completed' | 'partial', dayIndex = 0) {
  vi.setSystemTime(new Date(`${date}T10:00:00-03:00`));
  const day = template.days[dayIndex]!;
  const prescribed = day.exercises[0]!;
  const session = await startSession({
    programId: program.id,
    scheduledWorkoutId: null,
    dayId: day.id,
    title: day.name,
    timeZone: program.timeZone,
    programWeek: null,
    adaptation: true,
    exercises: [{ slotId: prescribed.id, variantId: prescribed.variantId, prescription: { ...prescribed, sets: status === 'partial' ? 2 : 1 } }],
  });
  const se = (await db.sessionExercises.where('sessionId').equals(session.id).first())!;
  const set = (await liveSetsOf(se.id))[0]!;
  await confirmSet(set.id, { load: 10, reps: 10 }, set.rev);
  await finishSession(session.id, status);
  return session;
}

describe('adaptación derivada del historial real', () => {
  it('cuatro parciales y las ausencias no adelantan ni disparan una decisión de adaptación', async () => {
    for (const date of ['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-17']) await record(date, 'partial');
    const state = await adaptationFor(program, template, '2027-03-27');
    expect(state).toMatchObject({ active: true, pendingDecision: false });
    expect(state.reason).toContain('0 de 8');
  });

  it('al alcanzar ocho completas espera la decisión explícita antes de aumentar volumen', async () => {
    for (let i = 0; i < 8; i++) await record(`2026-10-${12 + i}`, 'completed', i % 4);
    expect(await adaptationFor(program, template, '2026-10-20')).toMatchObject({ active: true, pendingDecision: true });
    vi.setSystemTime(new Date('2026-10-20T10:00:00-03:00'));
    await endAdaptation(program);
    expect(await adaptationFor(program, template, '2026-10-20')).toMatchObject({ active: false, pendingDecision: false });
  });

  it('una parcial reciente cuenta como actividad después de terminar la adaptación', async () => {
    for (let i = 0; i < 8; i++) await record(`2026-10-${12 + i}`, 'completed', i % 4);
    vi.setSystemTime(new Date('2026-10-20T10:00:00-03:00'));
    await endAdaptation(program);
    await record('2026-10-30', 'partial');
    expect(await adaptationFor(program, template, '2026-11-02')).toMatchObject({ active: false, pendingDecision: false });
  });

  it('conserva una decisión previa de terminar incluso con menos completas que el nuevo umbral', async () => {
    await record('2026-10-12', 'completed');
    vi.setSystemTime(new Date('2026-10-13T10:00:00-03:00'));
    await endAdaptation(program);
    expect(await adaptationFor(program, template, '2026-10-13')).toMatchObject({ active: false, pendingDecision: false });
  });

  it('mantener extiende por bloques de cuatro completas y reactiva una decisión previa', async () => {
    for (let i = 0; i < 9; i++) await record(`2026-10-${12 + i}`, 'completed', i % 4);
    vi.setSystemTime(new Date('2026-10-21T10:00:00-03:00'));
    await endAdaptation(program);
    vi.setSystemTime(new Date('2027-01-21T10:00:00-03:00'));
    await keepAdaptation(program, '2027-01-21');
    const updated = (await db.programs.get(program.id))!;
    expect(updated.adaptationWeeks).toBe(3);
    expect(await adaptationFor(updated, template, '2027-01-21')).toMatchObject({ active: true, pendingDecision: false });
    const decisions = await db.programDecisions.where('programId').equals(program.id).toArray();
    expect(decisions.find((d) => d.kind === 'keep-adaptation')?.detail).toContain('12 sesiones completas');
  });

  it('dos extensiones concurrentes usan el umbral actual sin pisar cambios', async () => {
    vi.setSystemTime(new Date('2026-10-20T10:00:00-03:00'));
    await Promise.all([keepAdaptation(program, '2026-10-20'), keepAdaptation(program, '2026-10-20')]);
    expect((await db.programs.get(program.id))?.adaptationWeeks).toBe(4);
    expect(await db.programDecisions.where('programId').equals(program.id).count()).toBe(2);
  });

  it('si falla registrar la decisión, también revierte la extensión del programa', async () => {
    vi.setSystemTime(new Date('2026-10-20T10:00:00-03:00'));
    const failure = vi.spyOn(db.programDecisions, 'add').mockRejectedValueOnce(new Error('Fallo de almacenamiento'));
    try {
      await expect(keepAdaptation(program, '2026-10-20')).rejects.toThrow('Fallo de almacenamiento');
      expect((await db.programs.get(program.id))?.adaptationWeeks).toBe(2);
      expect(await db.programDecisions.count()).toBe(0);
    } finally {
      failure.mockRestore();
    }
  });

  it('las sesiones de días retirados no cumplen el umbral ni reinician la actividad', async () => {
    const session = await record('2026-10-12', 'completed');
    await db.sessions.update(session.id, { dayId: 'dia-retirado' });
    const state = await adaptationFor(program, template, '2026-10-20');
    expect(state).toMatchObject({ active: true, pendingDecision: false });
    expect(state.reason).toContain('0 de 8');
  });
});
