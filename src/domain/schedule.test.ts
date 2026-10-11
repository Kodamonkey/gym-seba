import { describe, expect, it } from 'vitest';
import { adaptationState, compliance, planStatus, programWeek, recurrenceDates } from './schedule';

describe('semana de programa', () => {
  it('cuenta semanas desde la fecha de inicio, no desde el lunes', () => {
    expect(programWeek('2026-10-14', '2026-10-14')).toBe(1);
    expect(programWeek('2026-10-14', '2026-10-20')).toBe(1);
    expect(programWeek('2026-10-14', '2026-10-21')).toBe(2);
    expect(programWeek('2026-10-14', '2026-10-13')).toBe(0);
  });
});

describe('recurrencia', () => {
  it('genera 4 sesiones por semana durante 8 semanas', () => {
    const dates = recurrenceDates(
      { startDate: '2026-10-12', weeks: 8, weekdays: { a: 1, b: 2, c: 4, d: 6 } },
      ['a', 'b', 'c', 'd'],
    );
    expect(dates).toHaveLength(32);
    expect(dates[0]).toEqual({ dayId: 'a', date: '2026-10-12' });
    expect(dates[dates.length - 1]).toEqual({ dayId: 'd', date: '2026-12-05' });
  });

  it('cruza el cambio de año sin duplicar ni saltar días', () => {
    const dates = recurrenceDates({ startDate: '2026-12-28', weeks: 2, weekdays: { a: 1 } }, ['a']);
    expect(dates.map((d) => d.date)).toEqual(['2026-12-28', '2027-01-04']);
  });
});

describe('adaptación', () => {
  const program = { id: 'p', startDate: '2026-10-12', adaptationWeeks: 2 };

  it('activa durante las semanas 1–2', () => {
    const s = adaptationState({ program, daysPerWeek: 4, today: '2026-10-20', completedDates: [], decisions: [] });
    expect(s.active).toBe(true);
    expect(s.pendingDecision).toBe(false);
  });

  it('no desaparece en silencio si no se entrenó durante la adaptación', () => {
    const s = adaptationState({ program, daysPerWeek: 4, today: '2026-10-27', completedDates: ['2026-10-12'], decisions: [] });
    expect(s.active).toBe(true);
    expect(s.pendingDecision).toBe(true);
  });

  it('respeta la decisión de terminarla', () => {
    const s = adaptationState({
      program,
      daysPerWeek: 4,
      today: '2026-10-27',
      completedDates: ['2026-10-12'],
      decisions: [{ id: 'd', programId: 'p', kind: 'end-adaptation', detail: '', createdAt: '2026-10-26T12:00:00.000Z' }],
    });
    expect(s.active).toBe(false);
    expect(s.pendingDecision).toBe(false);
  });

  it('ofrece volver tras 14 días sin entrenar', () => {
    const done = ['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-17', '2026-10-19', '2026-10-20'];
    const s = adaptationState({ program, daysPerWeek: 4, today: '2026-11-10', completedDates: done, decisions: [] });
    expect(s.pendingDecision).toBe(true);
  });
});

describe('estados y cumplimiento', () => {
  it('una sesión pasada sin registro no es "completada"', () => {
    expect(planStatus({ date: '2026-10-10', skippedConfirmed: false, sessionId: null }, undefined, '2026-10-11')).toBe(
      'unclassified',
    );
    expect(planStatus({ date: '2026-10-10', skippedConfirmed: true, sessionId: null }, undefined, '2026-10-11')).toBe(
      'skipped',
    );
  });

  it('calcula cumplimiento con parciales aparte y sin contar el día de hoy pendiente', () => {
    const c = compliance(
      [
        { date: '2026-10-05', status: 'completed' },
        { date: '2026-10-06', status: 'partial' },
        { date: '2026-10-08', status: 'skipped' },
        { date: '2026-10-11', status: 'planned' },
      ],
      '2026-10-11',
    );
    expect(c.due).toBe(3);
    expect(c.completed).toBe(1);
    expect(c.partial).toBe(1);
    expect(c.ratio).toBeCloseTo(1 / 3);
  });

  it('sin sesiones previstas el cumplimiento es nulo, no cero', () => {
    expect(compliance([], '2026-10-11').ratio).toBeNull();
  });
});
