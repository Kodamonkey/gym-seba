import { beforeEach, describe, expect, it } from 'vitest';
import type { Prescription } from '../domain/types';
import { db } from './db';
import { ensureSeeded } from './seed';
import {
  addSet,
  confirmSet,
  finishSession,
  liveSetsOf,
  sessionCompleteness,
  setUnilateralLogging,
  startSession,
  substituteVariant,
  updateSet,
} from './sessions';

const PRESCRIPTION: Prescription = {
  sets: 3,
  repMin: 12,
  repMax: 20,
  repsMode: 'total',
  restSec: 75,
  rirMin: 2,
  rirMax: 3,
};

async function start(variantId: string, prescription: Prescription = PRESCRIPTION) {
  const session = await startSession({
    programId: null,
    scheduledWorkoutId: null,
    dayId: null,
    title: 'Prueba de sustitución',
    timeZone: 'America/Santiago',
    programWeek: null,
    adaptation: false,
    exercises: [{ slotId: 'lateral', variantId, prescription }],
  });
  const exercise = (await db.sessionExercises.where('sessionId').equals(session.id).first())!;
  return { session, exercise };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

describe('prescripción de la alternativa', () => {
  it('usa repeticiones por lado al pasar de bilateral a unilateral y limpia los borradores', async () => {
    const { exercise } = await start('v-db-lateral-raise');
    const first = (await liveSetsOf(exercise.id))[0]!;
    await updateSet(first.id, { load: 8, reps: 15, rir: 2 }, first.rev);

    await substituteVariant(exercise.id, 'v-cable-lateral-raise');

    const changed = (await db.sessionExercises.get(exercise.id))!;
    expect(changed.prescribed).toEqual({ ...PRESCRIPTION, repsMode: 'per-side' });
    expect(changed.variant.laterality).toBe('unilateral');
    expect(await liveSetsOf(exercise.id)).toHaveLength(3);
    expect((await liveSetsOf(exercise.id)).every((set) => set.load === null && set.reps === null && set.rir === null)).toBe(true);
  });

  it('usa repeticiones totales al pasar de unilateral a bilateral', async () => {
    const { exercise } = await start('v-cable-lateral-raise', { ...PRESCRIPTION, repsMode: 'per-side' });
    await substituteVariant(exercise.id, 'v-db-lateral-raise');
    expect((await db.sessionExercises.get(exercise.id))?.prescribed).toEqual(PRESCRIPTION);
  });

  it('adapta solo las series restantes después de confirmar una serie', async () => {
    const { session, exercise } = await start('v-db-lateral-raise');
    const first = (await liveSetsOf(exercise.id))[0]!;
    const completed = await confirmSet(first.id, { load: 8, reps: 15, rir: 2 }, first.rev);

    const addedId = await substituteVariant(exercise.id, 'v-cable-lateral-raise');

    expect((await db.sessionExercises.get(exercise.id))?.prescribed).toEqual({ ...PRESCRIPTION, sets: 1 });
    expect((await db.sessionExercises.get(addedId))?.prescribed).toEqual({ ...PRESCRIPTION, sets: 2, repsMode: 'per-side' });
    expect(await db.setLogs.get(first.id)).toEqual(completed);
    expect((await liveSetsOf(addedId)).every((set) => set.load === null && set.reps === null)).toBe(true);
    expect(await sessionCompleteness(session.id)).toEqual({ done: 1, expected: 3, pendingDrafts: 2 });
  });

  it('conserva pares realizados al sustituir filas por lado con una variante bilateral', async () => {
    const { exercise } = await start('v-cable-lateral-raise', { ...PRESCRIPTION, repsMode: 'per-side' });
    await setUnilateralLogging(exercise.id, 'per-side-rows');
    const rows = await liveSetsOf(exercise.id);
    const completed = [];
    for (const set of rows.slice(0, 2)) completed.push(await confirmSet(set.id, { load: 5, reps: 15 }, set.rev));

    const addedId = await substituteVariant(exercise.id, 'v-db-lateral-raise');

    expect(await liveSetsOf(exercise.id)).toEqual(completed);
    expect((await db.sessionExercises.get(addedId))?.prescribed).toEqual({ ...PRESCRIPTION, sets: 2 });
    expect(await liveSetsOf(addedId)).toHaveLength(2);
  });

  it('conserva los rangos planificados al alternar Pallof por repeticiones y por tiempo', async () => {
    const planned: Prescription = { ...PRESCRIPTION, repMin: 10, repMax: 12, repsMode: 'per-side', durationMin: 20, durationMax: 30 };
    const { exercise } = await start('v-pallof-press', planned);
    await substituteVariant(exercise.id, 'v-pallof-hold');
    expect((await db.sessionExercises.get(exercise.id))?.prescribed).toEqual(planned);
    expect((await db.sessionExercises.get(exercise.id))?.variant.measure).toBe('time');
    await substituteVariant(exercise.id, 'v-pallof-press');
    expect((await db.sessionExercises.get(exercise.id))?.prescribed).toEqual(planned);
    expect((await db.sessionExercises.get(exercise.id))?.variant.measure).toBe('reps');
  });

  it.each([
    {},
    { durationMin: 20 },
    { durationMin: 30, durationMax: 20 },
    { durationMin: 0, durationMax: 30 },
  ])('rechaza una variante por tiempo sin un rango válido sin alterar registros (%j)', async (duration) => {
    const { exercise } = await start('v-pallof-press', { ...PRESCRIPTION, repsMode: 'per-side', ...duration });
    const sets = await liveSetsOf(exercise.id);
    const first = sets[0]!;
    await updateSet(first.id, { load: 10, reps: 10 }, first.rev);
    const before = await liveSetsOf(exercise.id);

    await expect(substituteVariant(exercise.id, 'v-pallof-hold')).rejects.toThrow(/rango de segundos planificado/);

    expect(await db.sessionExercises.get(exercise.id)).toEqual(exercise);
    expect(await liveSetsOf(exercise.id)).toEqual(before);
    expect(await db.sessionExercises.count()).toBe(1);
  });

  it('respeta la unidad del equipo en borradores sustituidos, nuevos y por lado', async () => {
    await db.equipment.update('eq-cable-column', { unit: 'lb' });
    await db.meta.put({ key: 'lastEquipment:v-cable-lateral-raise', value: 'eq-cable-column' });
    const { session, exercise } = await start('v-db-lateral-raise');
    await substituteVariant(exercise.id, 'v-cable-lateral-raise');

    expect((await db.sessionExercises.get(exercise.id))?.unit).toBe('lb');
    expect((await liveSetsOf(exercise.id)).every((set) => set.unit === 'lb')).toBe(true);
    expect((await addSet(exercise.id)).unit).toBe('lb');
    await setUnilateralLogging(exercise.id, 'per-side-rows');
    expect((await liveSetsOf(exercise.id)).every((set) => set.unit === 'lb')).toBe(true);

    await finishSession(session.id, 'partial');
    const next = await start('v-cable-lateral-raise', { ...PRESCRIPTION, repsMode: 'per-side' });
    expect((await liveSetsOf(next.exercise.id)).every((set) => set.unit === 'lb')).toBe(true);
  });

  it('no altera ejercicios ni series de una sesión histórica al sustituir en otra', async () => {
    const prior = await start('v-db-lateral-raise');
    const first = (await liveSetsOf(prior.exercise.id))[0]!;
    await confirmSet(first.id, { load: 8, reps: 15 }, first.rev);
    await finishSession(prior.session.id, 'partial');
    const historicalExercise = await db.sessionExercises.get(prior.exercise.id);
    const historicalSets = await liveSetsOf(prior.exercise.id);

    const current = await start('v-db-lateral-raise');
    await substituteVariant(current.exercise.id, 'v-cable-lateral-raise');

    expect(await db.sessionExercises.get(prior.exercise.id)).toEqual(historicalExercise);
    expect(await liveSetsOf(prior.exercise.id)).toEqual(historicalSets);
  });

  it('mantiene kg en las series realizadas y usa lb en las restantes de otro equipo', async () => {
    await db.equipment.update('eq-cable-column', { unit: 'lb' });
    await db.meta.put({ key: 'lastEquipment:v-cable-lateral-raise', value: 'eq-cable-column' });
    const { exercise } = await start('v-db-lateral-raise');
    const first = (await liveSetsOf(exercise.id))[0]!;
    const completed = await confirmSet(first.id, { load: 8, reps: 15 }, first.rev);

    const addedId = await substituteVariant(exercise.id, 'v-cable-lateral-raise');

    expect(await db.setLogs.get(first.id)).toEqual(completed);
    expect(completed.unit).toBe('kg');
    expect((await liveSetsOf(addedId)).every((set) => set.unit === 'lb' && set.load === null)).toBe(true);
  });
});
