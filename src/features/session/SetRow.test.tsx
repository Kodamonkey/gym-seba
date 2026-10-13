// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionExercise, SetLog } from '../../domain/types';
import { ConflictError } from '../../data/db';
import { confirmSet, uncompleteSet, updateSet } from '../../data/sessions';
import { SetRow } from './SetRow';

vi.mock('../../app/hooks', () => ({ usePrefs: () => ({ autoStartRest: false }) }));
vi.mock('../../data/sessions', () => ({ updateSet: vi.fn(), confirmSet: vi.fn(), uncompleteSet: vi.fn(), previousComparable: vi.fn() }));
vi.mock('../../data/timers', () => ({ startRestTimer: vi.fn() }));

const now = '2026-10-12T15:00:00.000Z';
const exercise: SessionExercise = {
  id: 'exercise', sessionId: 'session', order: 1, slotId: null, variantId: 'press',
  variant: {
    name: 'Press de pecho', exerciseId: 'press', equipmentKind: 'machine', config: {},
    laterality: 'bilateral', implements: 1, loadConvention: 'machine-stack', measure: 'reps', requiresEquipmentInstance: false,
  },
  equipmentInstanceId: null, unit: 'kg', baseResistance: null,
  prescribed: { sets: 2, repMin: 8, repMax: 12, repsMode: 'total', restSec: 60, rirMin: 2, rirMax: 3 },
  substitutedFromVariantId: null, unilateralLogging: 'one-row-per-side-reps', restBetweenSides: false,
  techniqueConfirmed: null, painReported: false, notes: '', rev: 1, createdAt: now, updatedAt: now,
};
const initial: SetLog = {
  id: 'set', sessionId: 'session', sessionExerciseId: 'exercise', order: 1, kind: 'work', side: null,
  load: null, unit: 'kg', reps: null, durationSec: null, rir: null, status: 'draft', completedAt: null,
  rev: 1, createdAt: now, updatedAt: now, deletedAt: null,
};
let stored: SetLog;

function row(set = initial, canEdit = true) {
  return <SetRow set={set} se={exercise} canEdit={canEdit} label="1" />;
}
function typeLoad(value: string) {
  const input = screen.getByRole('textbox', { name: 'Carga serie 1' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value } });
  return input;
}
async function advance(ms = 400) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  stored = { ...initial };
  vi.mocked(updateSet).mockImplementation(async (_id, patch, rev) => {
    if (rev !== stored.rev) throw new ConflictError();
    stored = { ...stored, ...patch, rev: stored.rev + 1 };
    return stored;
  });
  vi.mocked(confirmSet).mockImplementation(async (_id, patch, rev) => {
    if (rev !== stored.rev) throw new ConflictError();
    stored = { ...stored, ...patch, status: 'completed', completedAt: now, rev: stored.rev + 1 };
    return stored;
  });
});
afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-test-obstacle]').forEach((element) => element.remove());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('registro móvil de series', () => {
  it('guarda el último valor aunque el campo conserve el foco, como borrador', async () => {
    render(row());
    typeLoad('12,5');
    await advance();
    expect(stored).toMatchObject({ load: 12.5, reps: null, status: 'draft', completedAt: null });
    expect(confirmSet).not.toHaveBeenCalled();
  });

  it('guarda al suspender la página antes del debounce', async () => {
    render(row());
    typeLoad('25');
    await act(async () => { window.dispatchEvent(new Event('pagehide')); });
    expect(stored.load).toBe(25);
    expect(stored.status).toBe('draft');
  });

  it('encadena blur y confirmación rápida sin duplicados ni conflictos de revisión', async () => {
    render(row());
    const load = typeLoad('30');
    fireEvent.blur(load);
    const reps = screen.getByRole('textbox', { name: 'Repeticiones serie 1' });
    fireEvent.change(reps, { target: { value: '10' } });
    fireEvent.blur(reps);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Marcar serie 1 como hecha' }));
      fireEvent.click(screen.getByRole('button', { name: 'Marcar serie 1 como hecha' }));
    });
    await advance();
    expect(stored).toMatchObject({ load: 30, reps: 10, status: 'completed' });
    expect(confirmSet).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(vi.mocked(confirmSet).mock.calls[0]?.[2]).toBe(stored.rev - 1);
  });

  it('descarta la edición pendiente si otra pestaña toma el control y adopta sus datos', async () => {
    const { rerender } = render(row());
    typeLoad('30');
    stored = { ...stored, load: 45, reps: 8, rev: 2 };
    rerender(row(stored, false));
    await advance();
    expect(updateSet).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Carga serie 1' })).toHaveValue('45');
    rerender(row(stored, true));
    typeLoad('50');
    await advance();
    expect(stored.load).toBe(50);
    expect(vi.mocked(updateSet).mock.calls[0]?.[2]).toBe(2);
  });

  it('no sobrescribe un cambio externo con el valor que aún se está escribiendo', async () => {
    const { rerender } = render(row());
    typeLoad('30');
    stored = { ...stored, load: 45, reps: 8, rev: 2 };
    rerender(row(stored));
    await advance();
    expect(stored.load).toBe(45);
    expect(updateSet).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Carga serie 1' })).toHaveValue('45');
  });

  it('no crea una revisión nueva al salir de un campo ya guardado', async () => {
    render(row());
    const input = typeLoad('30');
    await advance();
    fireEvent.blur(input);
    await advance();
    expect(updateSet).toHaveBeenCalledTimes(1);
  });

  it('conserva lo recién escrito mientras llega el resultado del guardado anterior', async () => {
    let resolve!: (set: SetLog) => void;
    vi.mocked(updateSet).mockImplementationOnce(async (_id, patch, rev) => {
      if (rev !== stored.rev) throw new ConflictError();
      stored = { ...stored, ...patch, rev: stored.rev + 1 };
      return new Promise<SetLog>((done) => { resolve = done; });
    });
    const { rerender } = render(row());
    typeLoad('30');
    await advance();
    const firstSaved = stored;
    typeLoad('35');
    rerender(row(firstSaved));
    expect(screen.getByRole('textbox', { name: 'Carga serie 1' })).toHaveValue('35');
    await act(async () => { resolve(firstSaved); });
    await advance();
    expect(stored).toMatchObject({ load: 35, rev: 3, status: 'draft' });
    expect(screen.getByRole('textbox', { name: 'Carga serie 1' })).toHaveValue('35');
  });

  it('detiene la confirmación si el guardado pendiente encuentra un cambio ajeno', async () => {
    let reject!: (error: Error) => void;
    vi.mocked(updateSet).mockImplementationOnce(() => new Promise<SetLog>((_done, fail) => { reject = fail; }));
    const { rerender } = render(row());
    typeLoad('30');
    await advance();
    fireEvent.change(screen.getByRole('textbox', { name: 'Repeticiones serie 1' }), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar serie 1 como hecha' }));
    stored = { ...stored, load: 45, reps: 8, rev: 2 };
    rerender(row(stored));
    await act(async () => { reject(new ConflictError()); });
    await advance();
    expect(confirmSet).not.toHaveBeenCalled();
    expect(stored).toMatchObject({ load: 45, reps: 8, status: 'draft' });
    expect(screen.getByRole('textbox', { name: 'Carga serie 1' })).toHaveValue('45');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('conserva el último campo al navegar fuera de la sesión', async () => {
    const { unmount } = render(row());
    typeLoad('25');
    await act(async () => { unmount(); });
    expect(stored).toMatchObject({ load: 25, status: 'draft' });
  });

  it('permite reabrir una serie con un solo guardado aunque se toque dos veces', async () => {
    stored = { ...stored, load: 30, reps: 10, status: 'completed', completedAt: now };
    let resolve!: (set: SetLog) => void;
    vi.mocked(uncompleteSet).mockImplementation(() => new Promise<SetLog>((done) => { resolve = done; }));
    render(row(stored));
    await act(async () => {
      const button = screen.getByRole('button', { name: 'Serie 1 hecha. Tocar para corregir' });
      fireEvent.click(button);
      fireEvent.click(button);
      resolve({ ...stored, status: 'draft', completedAt: null, rev: 2 });
    });
    expect(uncompleteSet).toHaveBeenCalledTimes(1);
  });

  it('pide la unidad de la máquina importada al faltar la carga', async () => {
    render(<SetRow set={{ ...initial, unit: 'lb' }} se={{ ...exercise, unit: 'lb' }} canEdit label="1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Marcar serie 1 como hecha' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe lb y reps');
  });

  it.each([
    { name: 'temporizador de dos filas', obstacle: 'timer', obstacleTop: 220, obstacleBottom: 360, inputTop: 185, offsetTop: 0 },
    { name: 'encabezado con área segura', obstacle: 'header', obstacleTop: 0, obstacleBottom: 100, inputTop: 90, offsetTop: 0 },
    { name: 'viewport desplazado por el teclado', obstacle: null, obstacleTop: 0, obstacleBottom: 0, inputTop: 70, offsetTop: 80 },
  ])('centra un campo oculto por $name', async ({ obstacle, obstacleTop, obstacleBottom, inputTop, offsetTop }) => {
    vi.stubGlobal('visualViewport', { height: 360, offsetTop });
    render(row());
    if (obstacle) {
      const element = document.createElement(obstacle === 'header' ? 'header' : 'div');
      element.dataset.testObstacle = 'true';
      if (obstacle === 'header') element.className = 'sticky';
      else {
        element.setAttribute('role', 'region');
        element.setAttribute('aria-label', 'Descanso');
      }
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({ top: obstacleTop, bottom: obstacleBottom } as DOMRect);
      document.body.appendChild(element);
    }
    const input = screen.getByRole('textbox', { name: 'Carga serie 1' });
    vi.spyOn(input, 'getBoundingClientRect').mockReturnValue({ top: inputTop, bottom: inputTop + 48 } as DOMRect);
    const scroll = vi.fn();
    Object.defineProperty(input, 'scrollIntoView', { value: scroll });
    act(() => { input.focus(); });
    await advance();
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
  });
});
