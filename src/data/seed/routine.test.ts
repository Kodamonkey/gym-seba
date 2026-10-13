import { describe, expect, it } from 'vitest';
import { effectivePrescription } from '../../domain/schedule';
import { VARIANT_BY_ID } from './catalog';
import { ROUTINE_TEMPLATE } from './routine';

describe('rutina de fuerza e hipertrofia con alternativas', () => {
  it('mantiene cuatro días no consecutivos por región y un volumen inicial manejable', () => {
    expect(ROUTINE_TEMPLATE.version).toBe(2);
    expect(ROUTINE_TEMPLATE.weeksTotal).toBe(8);
    expect(ROUTINE_TEMPLATE.days.map((day) => day.weekday)).toEqual([1, 2, 4, 6]);
    for (const day of ROUTINE_TEMPLATE.days) {
      expect(day.exercises).toHaveLength(6);
      expect(day.exercises.reduce((total, ex) => total + ex.sets, 0)).toBe(14);
      expect(day.exercises.reduce((total, ex) => total + effectivePrescription(ex, true, ROUTINE_TEMPLATE).sets, 0)).toBe(12);
      expect(Object.values(day.timeSplit).reduce((total, min) => total + min, 0)).toBe(60);
    }
  });

  it('todo ejercicio tiene alternativas identificadas sin prometer equivalencia de otros movimientos', () => {
    for (const day of ROUTINE_TEMPLATE.days) {
      for (const ex of day.exercises) {
        const primary = VARIANT_BY_ID.get(ex.variantId)!;
        expect(primary).toBeDefined();
        expect(ex.alternativeVariantIds.length).toBeGreaterThan(0);
        expect(new Set(ex.alternativeVariantIds).size).toBe(ex.alternativeVariantIds.length);
        expect(ex.alternativeVariantIds).not.toContain(ex.variantId);
        for (const id of ex.alternativeVariantIds) expect(VARIANT_BY_ID.has(id)).toBe(true);
        const different = ex.alternativeVariantIds.some((id) => VARIANT_BY_ID.get(id)?.exerciseId !== primary.exerciseId);
        // Las diferencias de patrón relevantes tienen explicación en la ficha o en la guía.
        if (primary.id === 'v-leg-extension' || primary.id === 'v-smith-hip-thrust') {
          expect(different).toBe(true);
          expect(ex.notes.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('mantiene esfuerzo orientativo y recuperación suficiente sin asignar cargas iniciales', () => {
    for (const day of ROUTINE_TEMPLATE.days) {
      for (const ex of day.exercises) {
        expect([ex.rirMin, ex.rirMax]).toEqual([2, 3]);
        expect(ex.repMin).toBeLessThanOrEqual(ex.repMax);
        expect(ex.restSec).toBeGreaterThanOrEqual(60);
        if (ex.sets === 3) expect(ex.restSec).toBeGreaterThanOrEqual(120);
        const variant = VARIANT_BY_ID.get(ex.variantId)!;
        expect(ex.repsMode).toBe(variant.laterality === 'unilateral' ? 'per-side' : 'total');
        expect(ex).not.toHaveProperty('load');
      }
    }
  });
});
