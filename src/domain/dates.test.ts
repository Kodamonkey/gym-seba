import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  diffDays,
  formatInstantWithOffset,
  isLocalDate,
  isoWeekday,
  localDateOf,
  monthGrid,
  offsetMinutes,
  startOfWeek,
  todayLocal,
} from './dates';

describe('fechas civiles', () => {
  it('valida fechas reales', () => {
    expect(isLocalDate('2026-02-28')).toBe(true);
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('2026-13-01')).toBe(false);
    expect(isLocalDate('2026-1-01')).toBe(false);
  });

  it('suma días a través de meses y años', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('no se desplaza en días de cambio de horario de Chile', () => {
    // 2026-04-04 (fin del horario de verano) y 2026-09-05/06 (inicio).
    expect(addDays('2026-04-04', 1)).toBe('2026-04-05');
    expect(addDays('2026-09-05', 1)).toBe('2026-09-06');
    expect(diffDays('2026-09-01', '2026-09-30')).toBe(29);
    expect(diffDays('2026-04-01', '2026-04-30')).toBe(29);
  });

  it('suma meses recortando al fin de mes', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
  });

  it('calcula día ISO y lunes de la semana', () => {
    expect(isoWeekday('2026-10-11')).toBe(7); // domingo
    expect(isoWeekday('2026-10-12')).toBe(1); // lunes
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05');
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });

  it('arma grillas mensuales completas', () => {
    const grid = monthGrid('2026-02-10');
    expect(grid[0]?.[0]).toBe('2026-01-26');
    expect(grid.every((w) => w.length === 7)).toBe(true);
    expect(grid.flat()).toContain('2026-02-28');
  });
});

describe('instantes en America/Santiago', () => {
  const tz = 'America/Santiago';

  it('asigna la fecha local correcta cerca de medianoche', () => {
    // 23:30 del 31-dic en Santiago (UTC−3) es 02:30Z del 1-ene.
    expect(localDateOf('2027-01-01T02:30:00Z', tz)).toBe('2026-12-31');
    expect(localDateOf('2027-01-01T03:30:00Z', tz)).toBe('2027-01-01');
  });

  it('maneja el inicio del horario de verano (medianoche inexistente)', () => {
    expect(localDateOf('2026-09-06T03:59:00Z', tz)).toBe('2026-09-05');
    expect(localDateOf('2026-09-06T04:00:00Z', tz)).toBe('2026-09-06');
    expect(offsetMinutes('2026-09-06T03:59:00Z', tz)).toBe(-240);
    expect(offsetMinutes('2026-09-06T04:00:00Z', tz)).toBe(-180);
  });

  it('maneja el fin del horario de verano (hora repetida)', () => {
    expect(localDateOf('2026-04-05T02:30:00Z', tz)).toBe('2026-04-04');
    expect(localDateOf('2026-04-05T03:30:00Z', tz)).toBe('2026-04-04');
    expect(localDateOf('2026-04-05T04:30:00Z', tz)).toBe('2026-04-05');
  });

  it('formatea con desfase explícito', () => {
    expect(formatInstantWithOffset('2026-10-11T12:30:00.000Z', tz)).toBe('2026-10-11T09:30:00-03:00');
    expect(formatInstantWithOffset('2026-07-01T12:30:00.000Z', tz)).toBe('2026-07-01T08:30:00-04:00');
  });

  it('todayLocal no depende de la zona del dispositivo', () => {
    expect(todayLocal(tz, new Date('2026-10-12T02:00:00Z'))).toBe('2026-10-11');
  });
});
