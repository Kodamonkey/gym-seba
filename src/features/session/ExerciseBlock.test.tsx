// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionExercise, SetLog, WorkoutSession } from '../../domain/types';
import { ExerciseBlock } from './ExerciseBlock';
import { suggestionsFor, type Suggestion } from './logic';

vi.mock('dexie-react-hooks', () => ({ useLiveQuery: () => null }));
vi.mock('./logic', () => ({ suggestionsFor: vi.fn() }));
vi.mock('./SetRow', () => ({
  SetRow: ({ suggestion }: { suggestion?: Suggestion }) => (
    <input aria-label="Carga sugerida" placeholder={suggestion?.load?.toString() ?? ''} />
  ),
}));

const now = '2026-10-12T15:00:00.000Z';
const session: WorkoutSession = {
  id: 'session', programId: null, scheduledWorkoutId: null, dayId: null,
  title: 'Entrenamiento', localDate: '2026-10-12', timeZone: 'America/Santiago',
  startedAt: now, endedAt: null, status: 'active', pauses: [], programWeek: null,
  adaptation: false, notes: '', ownerTabId: null, rev: 1, createdAt: now, updatedAt: now,
};
const exercise: SessionExercise = {
  id: 'exercise', sessionId: session.id, order: 1, slotId: null, variantId: 'press-machine',
  variant: {
    name: 'Press de pecho', exerciseId: 'press', equipmentKind: 'machine', config: {},
    laterality: 'bilateral', implements: 1, loadConvention: 'machine-stack', measure: 'reps', requiresEquipmentInstance: true,
  },
  equipmentInstanceId: 'machine-one', unit: 'kg', baseResistance: null,
  prescribed: { sets: 1, repMin: 8, repMax: 12, repsMode: 'total', restSec: 60, rirMin: 2, rirMax: 3 },
  substitutedFromVariantId: null, unilateralLogging: 'one-row-per-side-reps', restBetweenSides: false,
  techniqueConfirmed: null, painReported: false, notes: '', rev: 1, createdAt: now, updatedAt: now,
};
const draft: SetLog = {
  id: 'set', sessionId: session.id, sessionExerciseId: exercise.id, order: 1, kind: 'work', side: null,
  load: null, unit: 'kg', reps: null, durationSec: null, rir: null, status: 'draft', completedAt: null,
  rev: 1, createdAt: now, updatedAt: now, deletedAt: null,
};
type Suggestions = Awaited<ReturnType<typeof suggestionsFor>>;

function result(load: number): Suggestions {
  return {
    prev: null,
    byOrder: new Map([[0, { load, reps: 12, durationSec: null, source: 'previous', fromDate: '2026-10-11' }]]),
  };
}

function deferred() {
  let resolve!: (value: Suggestions) => void;
  const promise = new Promise<Suggestions>((done) => { resolve = done; });
  return { promise, resolve };
}

function block(se: SessionExercise, set: SetLog = draft) {
  return <ExerciseBlock session={session} se={se} sets={[set]} canEdit onTechnique={() => undefined} />;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe('sugerencias vinculadas al ejercicio actual', () => {
  it.each([
    { context: 'variante', patch: { variantId: 'press-dumbbell' } },
    { context: 'equipo', patch: { equipmentInstanceId: 'machine-two' } },
    { context: 'revisión', patch: { rev: 2 } },
    { context: 'unidad', patch: { unit: 'lb' as const } },
  ])('descarta valores anteriores al cambiar $context mientras llega la nueva consulta', async ({ patch }) => {
    const next = deferred();
    vi.mocked(suggestionsFor).mockResolvedValueOnce(result(40)).mockReturnValueOnce(next.promise);
    const { rerender } = render(block(exercise));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Carga sugerida' })).toHaveAttribute('placeholder', '40'));

    rerender(block({ ...exercise, ...patch }, { ...draft, id: 'new-set' }));
    expect(screen.getByRole('textbox', { name: 'Carga sugerida' })).toHaveAttribute('placeholder', '');
    expect(suggestionsFor).toHaveBeenCalledTimes(2);

    await act(async () => { next.resolve(result(8)); });
    expect(screen.getByRole('textbox', { name: 'Carga sugerida' })).toHaveAttribute('placeholder', '8');
  });

  it('ignora una respuesta anterior que llega después del cambio de variante', async () => {
    const previous = deferred();
    const next = deferred();
    vi.mocked(suggestionsFor).mockReturnValueOnce(previous.promise).mockReturnValueOnce(next.promise);
    const { rerender } = render(block(exercise));
    rerender(block({ ...exercise, variantId: 'press-dumbbell', rev: 2 }, { ...draft, id: 'new-set' }));

    await act(async () => { previous.resolve(result(40)); });
    expect(screen.getByRole('textbox', { name: 'Carga sugerida' })).toHaveAttribute('placeholder', '');
    await act(async () => { next.resolve(result(8)); });
    expect(screen.getByRole('textbox', { name: 'Carga sugerida' })).toHaveAttribute('placeholder', '8');
  });
});
