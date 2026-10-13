import { beforeEach, describe, expect, it } from 'vitest';
import { comparisonKeyOf } from '../../domain/load';
import type { LoadUnit, Prescription, SessionExercise } from '../../domain/types';
import { db } from '../../data/db';
import { ensureSeeded } from '../../data/seed';
import { confirmSet, finishSession, liveSetsOf, setUnilateralLogging, startSession } from '../../data/sessions';
import { suggestionsFor } from './logic';

const prescription: Prescription = { sets: 2, repMin: 8, repMax: 12, repsMode: 'total', restSec: 90, rirMin: 2, rirMax: 3 };

async function exercise(unit: LoadUnit, variantId = 'v-chest-press-machine', logging: SessionExercise['unilateralLogging'] = 'one-row-per-side-reps') {
  const session = await startSession({
    programId: null,
    scheduledWorkoutId: null,
    dayId: null,
    title: 'Entrenamiento',
    timeZone: 'America/Santiago',
    programWeek: null,
    adaptation: false,
    exercises: [{ slotId: null, variantId, prescription: { ...prescription, repsMode: variantId === 'v-pallof-press' ? 'per-side' : 'total' } }],
  });
  const se = (await db.sessionExercises.where('sessionId').equals(session.id).first())!;
  await db.sessionExercises.update(se.id, { unit });
  await setUnilateralLogging(se.id, logging);
  return (await db.sessionExercises.get(se.id))!;
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

describe('sugerencias de carga', () => {
  it.each([
    { from: 'lb' as const, to: 'kg' as const, load: 40, expected: 18.144 },
    { from: 'kg' as const, to: 'lb' as const, load: 22, expected: 48.502 },
    { from: 'kg' as const, to: 'kg' as const, load: 22.5, expected: 22.5 },
  ])('convierte el registro anterior de $from a $to sin modificarlo', async ({ from, to, load, expected }) => {
    const previous = await exercise(from);
    const set = (await liveSetsOf(previous.id))[0]!;
    await confirmSet(set.id, { load, reps: 12 }, set.rev);
    await finishSession(previous.sessionId, 'partial');
    const current = await exercise(to);

    const suggestions = await suggestionsFor(current);
    expect(suggestions.byOrder.get(0)).toMatchObject({ load: expected, reps: 12, source: 'previous' });
    expect(suggestions.prev?.sets[0]).toMatchObject({ load, unit: from });
    expect((await db.setLogs.get(set.id))?.load).toBe(load);
  });

  it('convierte una progresión aceptada a la unidad de la sesión actual', async () => {
    const previous = await exercise('lb');
    await finishSession(previous.sessionId, 'partial');
    const current = await exercise('kg');
    await db.progressionDecisions.add({
      id: 'decision-carga',
      comparisonKey: comparisonKeyOf(current).key,
      variantId: current.variantId,
      sessionId: previous.sessionId,
      decision: 'accepted',
      fromLoad: 45,
      toLoad: 50,
      unit: 'lb',
      createdAt: new Date().toISOString(),
    });

    const suggestions = await suggestionsFor(current);
    expect(suggestions.byOrder.get(0)).toMatchObject({ load: 22.68, source: 'progression' });
    expect(suggestions.byOrder.get(1)?.load).toBe(22.68);
    expect((await db.progressionDecisions.get('decision-carga'))?.toLoad).toBe(50);
  });

  it('conserva las cargas distintas de izquierda y derecha por índice de fila', async () => {
    const previous = await exercise('kg', 'v-pallof-press', 'per-side-rows');
    const rows = await liveSetsOf(previous.id);
    const loads = [10, 12, 20, 22];
    for (const [index, set] of rows.entries()) await confirmSet(set.id, { load: loads[index]!, reps: 10 }, set.rev);
    await finishSession(previous.sessionId, 'completed');
    const current = await exercise('kg', 'v-pallof-press', 'per-side-rows');

    const suggestions = await suggestionsFor(current);
    expect([...suggestions.byOrder.values()].map((suggestion) => suggestion.load)).toEqual(loads);
    expect(suggestions.prev?.sets.map((set) => set.side)).toEqual(['left', 'right', 'left', 'right']);
  });

  it.each([
    { previousMode: 'per-side-rows' as const, currentMode: 'one-row-per-side-reps' as const },
    { previousMode: 'one-row-per-side-reps' as const, currentMode: 'per-side-rows' as const },
  ])('mantiene el historial sin copiar sugerencias al pasar de $previousMode a $currentMode', async ({ previousMode, currentMode }) => {
    const previous = await exercise('kg', 'v-pallof-press', previousMode);
    const set = (await liveSetsOf(previous.id))[0]!;
    await confirmSet(set.id, { load: 10, reps: 10 }, set.rev);
    await finishSession(previous.sessionId, 'partial');
    const current = await exercise('kg', 'v-pallof-press', currentMode);

    const suggestions = await suggestionsFor(current);
    expect(suggestions.prev?.sets[0]?.load).toBe(10);
    expect(suggestions.byOrder.size).toBe(0);
  });

  it('una progresión aceptada prepara las cuatro filas de ambos lados', async () => {
    const previous = await exercise('lb', 'v-pallof-press', 'per-side-rows');
    await finishSession(previous.sessionId, 'partial');
    const current = await exercise('kg', 'v-pallof-press', 'per-side-rows');
    await db.progressionDecisions.add({
      id: 'decision-por-lado',
      comparisonKey: comparisonKeyOf(current).key,
      variantId: current.variantId,
      sessionId: previous.sessionId,
      decision: 'accepted',
      fromLoad: 45,
      toLoad: 50,
      unit: 'lb',
      createdAt: new Date().toISOString(),
    });

    const suggestions = await suggestionsFor(current);
    expect([...suggestions.byOrder.keys()]).toEqual([0, 1, 2, 3]);
    expect([...suggestions.byOrder.values()].map((suggestion) => suggestion.load)).toEqual([22.68, 22.68, 22.68, 22.68]);
  });
});
