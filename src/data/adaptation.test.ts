import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program, RoutineTemplate } from '../domain/types';
import { db } from './db';
import { adaptationFor, createProgram } from './program';
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

async function record(date: string, status: 'completed' | 'partial') {
  vi.setSystemTime(new Date(`${date}T10:00:00-03:00`));
  const prescribed = template.days[0]!.exercises[0]!;
  const session = await startSession({
    programId: program.id,
    scheduledWorkoutId: null,
    dayId: template.days[0]!.id,
    title: template.days[0]!.name,
    timeZone: program.timeZone,
    programWeek: null,
    adaptation: true,
    exercises: [{ slotId: prescribed.id, variantId: prescribed.variantId, prescription: { ...prescribed, sets: status === 'partial' ? 2 : 1 } }],
  });
  const se = (await db.sessionExercises.where('sessionId').equals(session.id).first())!;
  const set = (await liveSetsOf(se.id))[0]!;
  await confirmSet(set.id, { load: 10, reps: 10 }, set.rev);
  await finishSession(session.id, status);
}

describe('adaptación derivada del historial real', () => {
  it('cuatro registros parciales no terminan automáticamente la adaptación', async () => {
    for (const date of ['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-17']) await record(date, 'partial');
    const state = await adaptationFor(program, template, '2026-10-27');
    expect(state).toMatchObject({ active: true, pendingDecision: true });
    expect(state.reason).toContain('completaste 0 de 8');
  });

  it('una parcial reciente cuenta como actividad tras completar el umbral de adaptación', async () => {
    for (const date of ['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-17']) await record(date, 'completed');
    await record('2026-10-30', 'partial');
    expect(await adaptationFor(program, template, '2026-11-02')).toMatchObject({ active: false, pendingDecision: false });
  });
});
