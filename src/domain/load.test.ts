import { describe, expect, it } from 'vitest';
import { comparisonKey, normalizedLoadKg, setVolumeKg, type LoadContext } from './load';

const base: LoadContext = {
  loadConvention: 'per-implement',
  implements: 2,
  laterality: 'bilateral',
  measure: 'reps',
  unit: 'kg',
  baseResistance: null,
  repsMode: 'total',
};

describe('volumen registrado (casos del encargo)', () => {
  it('dos mancuernas de 10 kg, 10 repeticiones simultáneas = 200', () => {
    expect(setVolumeKg({ load: 10, reps: 10, side: null }, base)).toBe(200);
  });

  it('curl unilateral 10 kg, 10 por brazo en una fila = 200', () => {
    const ctx: LoadContext = { ...base, implements: 1, laterality: 'unilateral', repsMode: 'per-side' };
    expect(setVolumeKg({ load: 10, reps: 10, side: null }, ctx)).toBe(200);
  });

  it('las mismas repeticiones en dos filas por lado no se duplican', () => {
    const ctx: LoadContext = { ...base, implements: 1, laterality: 'unilateral', repsMode: 'per-side' };
    const left = setVolumeKg({ load: 10, reps: 10, side: 'left' }, ctx)!;
    const right = setVolumeKg({ load: 10, reps: 10, side: 'right' }, ctx)!;
    expect(left + right).toBe(200);
  });

  it('zancadas con dos mancuernas: implementos y lados se cuentan por separado', () => {
    const ctx: LoadContext = { ...base, implements: 2, laterality: 'unilateral', repsMode: 'per-side' };
    // 2 × 10 kg, 8 por pierna ⇒ 20 kg × 8 × 2 piernas.
    expect(setVolumeKg({ load: 10, reps: 8, side: null }, ctx)).toBe(320);
  });
});

describe('normalización de carga', () => {
  it('no asume el peso de la barra Smith', () => {
    const ctx: LoadContext = { ...base, loadConvention: 'plates-added', implements: 1 };
    expect(normalizedLoadKg(20, ctx)).toBe(20);
    expect(normalizedLoadKg(20, { ...ctx, baseResistance: 7 })).toBe(27);
  });

  it('convierte libras a kg conservando la regla', () => {
    const ctx: LoadContext = { ...base, loadConvention: 'machine-stack', implements: 1, unit: 'lb' };
    expect(normalizedLoadKg(100, ctx)).toBeCloseTo(45.359, 3);
  });

  it('carga no registrada no es cero', () => {
    const ctx: LoadContext = { ...base, loadConvention: 'machine-stack', implements: 1 };
    expect(normalizedLoadKg(null, ctx)).toBeNull();
    expect(normalizedLoadKg(0, ctx)).toBe(0);
    expect(setVolumeKg({ load: null, reps: 10, side: null }, ctx)).toBeNull();
  });

  it('no calcula volumen kg·reps en ejercicios por tiempo', () => {
    expect(setVolumeKg({ load: 10, reps: null, side: null }, { ...base, measure: 'time' })).toBeNull();
  });
});

describe('clave de comparación', () => {
  const input = {
    variantId: 'v-chest-press',
    equipmentInstanceId: 'eq-1',
    config: { agarre: 'neutro' },
    laterality: 'bilateral' as const,
    loadConvention: 'machine-stack' as const,
    requiresEquipmentInstance: true,
  };

  it('separa máquinas distintas', () => {
    expect(comparisonKey(input).key).not.toBe(comparisonKey({ ...input, equipmentInstanceId: 'eq-2' }).key);
  });

  it('marca comparabilidad no confirmada sin equipo identificado', () => {
    expect(comparisonKey({ ...input, equipmentInstanceId: null }).confirmed).toBe(false);
  });

  it('el peso libre no requiere instancia', () => {
    const k = comparisonKey({ ...input, equipmentInstanceId: null, requiresEquipmentInstance: false });
    expect(k.confirmed).toBe(true);
  });

  it('separa configuraciones (agarre)', () => {
    expect(comparisonKey(input).key).not.toBe(comparisonKey({ ...input, config: { agarre: 'prono' } }).key);
  });
});
