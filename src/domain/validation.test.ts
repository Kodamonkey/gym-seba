import { describe, expect, it } from 'vitest';
import { checkSetForConfirm, parseDecimal, parseDuration, parseLoad, parseReps, parseRir } from './validation';

describe('parseo de entradas', () => {
  it('acepta coma y punto decimal', () => {
    expect(parseLoad('12,5')).toEqual({ ok: true, value: 12.5 });
    expect(parseLoad('12.5')).toEqual({ ok: true, value: 12.5 });
    expect(parseLoad(' 20 ')).toEqual({ ok: true, value: 20 });
  });

  it('distingue vacío (no registrado) de cero explícito', () => {
    expect(parseLoad('')).toEqual({ ok: true, value: null });
    expect(parseLoad('   ')).toEqual({ ok: true, value: null });
    expect(parseLoad('0')).toEqual({ ok: true, value: 0 });
  });

  it('rechaza negativos y texto', () => {
    expect(parseLoad('-5').ok).toBe(false);
    expect(parseLoad('abc').ok).toBe(false);
    expect(parseLoad('1,2,3').ok).toBe(false);
    expect(parseDecimal('1e3').ok).toBe(false);
  });

  it('exige repeticiones enteras', () => {
    expect(parseReps('10')).toEqual({ ok: true, value: 10 });
    expect(parseReps('10,5').ok).toBe(false);
    expect(parseReps('-1').ok).toBe(false);
    expect(parseReps('')).toEqual({ ok: true, value: null });
  });

  it('valida RIR', () => {
    expect(parseRir('2')).toEqual({ ok: true, value: 2 });
    expect(parseRir('2,5')).toEqual({ ok: true, value: 2.5 });
    expect(parseRir('2,3').ok).toBe(false);
    expect(parseRir('11').ok).toBe(false);
  });

  it('valida duraciones', () => {
    expect(parseDuration('45')).toEqual({ ok: true, value: 45 });
    expect(parseDuration('1:30')).toEqual({ ok: true, value: 90 });
    expect(parseDuration('0').ok).toBe(false);
    expect(parseDuration('1:75').ok).toBe(false);
    expect(parseDuration('-10').ok).toBe(false);
  });
});

describe('confirmación de series', () => {
  const reps = { measure: 'reps', loadConvention: 'machine-stack' } as const;

  it('exige carga y repeticiones', () => {
    expect(checkSetForConfirm({ load: null, reps: 10, durationSec: null, rir: null }, reps).errors).toHaveLength(1);
    expect(checkSetForConfirm({ load: 40, reps: null, durationSec: null, rir: null }, reps).errors).toHaveLength(1);
    expect(checkSetForConfirm({ load: 0, reps: 10, durationSec: null, rir: null }, reps).errors).toHaveLength(0);
  });

  it('pide confirmación ante valores inusuales sin bloquear', () => {
    const r = checkSetForConfirm({ load: 400, reps: 60, durationSec: null, rir: null }, reps);
    expect(r.errors).toHaveLength(0);
    expect(r.warnings).toHaveLength(2);
  });

  it('usa duración en ejercicios por tiempo', () => {
    const ctx = { measure: 'time', loadConvention: 'machine-stack' } as const;
    expect(checkSetForConfirm({ load: 10, reps: null, durationSec: 30, rir: null }, ctx).errors).toHaveLength(0);
    expect(checkSetForConfirm({ load: 10, reps: null, durationSec: null, rir: null }, ctx).errors).toHaveLength(1);
  });

  it('no exige carga si la variante no tiene carga externa', () => {
    const ctx = { measure: 'reps', loadConvention: 'none' } as const;
    expect(checkSetForConfirm({ load: null, reps: 10, durationSec: null, rir: null }, ctx).errors).toHaveLength(0);
  });
});
