import { describe, expect, it } from 'vitest';
import { adviseProgression, type ProgressionInput } from './progression';

const base: ProgressionInput = {
  prescribed: { sets: 3, repMin: 8, repMax: 12, repsMode: 'total', restSec: 90, rirMin: 2, rirMax: 3 },
  measure: 'reps',
  workSets: [
    { load: 40, reps: 12, rir: 2, side: null },
    { load: 40, reps: 12, rir: 2, side: null },
    { load: 40, reps: 12, rir: 2, side: null },
  ],
  perSideRows: false,
  techniqueConfirmed: true,
  painReported: false,
  sessionComplete: true,
  minIncrement: 5,
  unit: 'kg',
};

describe('doble progresión', () => {
  it('sugiere el menor incremento cuando se cumplen todas las condiciones', () => {
    const a = adviseProgression(base);
    expect(a.kind).toBe('suggest-increase');
    if (a.kind === 'suggest-increase') {
      expect(a.to).toBe(45);
      expect(a.message).toContain('Completaste 3 × 12');
    }
  });

  it('no sugiere con dolor, técnica negativa o sesión incompleta', () => {
    expect(adviseProgression({ ...base, painReported: true }).kind).toBe('hold');
    expect(adviseProgression({ ...base, techniqueConfirmed: false }).kind).toBe('hold');
    expect(adviseProgression({ ...base, sessionComplete: false }).kind).toBe('hold');
  });

  it('pide confirmación si falta RIR o técnica', () => {
    const noRir = adviseProgression({ ...base, workSets: base.workSets.map((s) => ({ ...s, rir: null })) });
    expect(noRir.kind).toBe('needs-confirmation');
    const noTech = adviseProgression({ ...base, techniqueConfirmed: null });
    expect(noTech.kind).toBe('needs-confirmation');
  });

  it('mantiene si alguna serie no llegó al tope', () => {
    const ws = [...base.workSets];
    ws[2] = { load: 40, reps: 10, rir: 2, side: null };
    expect(adviseProgression({ ...base, workSets: ws }).kind).toBe('none');
  });

  it('no infiere facilidad con RIR por debajo del objetivo', () => {
    const ws = base.workSets.map((s) => ({ ...s, rir: 0 }));
    expect(adviseProgression({ ...base, workSets: ws }).kind).toBe('hold');
  });

  it('sin incremento conocido no inventa un valor', () => {
    const a = adviseProgression({ ...base, minIncrement: null });
    expect(a.kind).toBe('suggest-increase');
    if (a.kind === 'suggest-increase') expect(a.to).toBeNull();
  });
});
