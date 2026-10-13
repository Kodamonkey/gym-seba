import { describe, expect, it } from 'vitest';
import { routineSequence, sequenceAdaptationState } from './sequence';
import type { ProgramDecision, WorkoutSession } from './types';

const days = [{ id: 'upper-a' }, { id: 'lower-a' }, { id: 'upper-b' }, { id: 'lower-b' }];
const program = { id: 'program', adaptationWeeks: 2, timeZone: 'America/Santiago' };

function session(overrides: Partial<WorkoutSession> = {}): WorkoutSession {
  return {
    id: 'session', programId: program.id, scheduledWorkoutId: null, dayId: 'upper-a', title: 'Superior A',
    localDate: '2026-10-13', timeZone: program.timeZone, startedAt: '2026-10-13T13:00:00Z',
    endedAt: '2026-10-13T14:00:00Z', status: 'completed', pauses: [], programWeek: null,
    adaptation: true, notes: '', ownerTabId: null, rev: 1, createdAt: '2026-10-13T13:00:00Z',
    updatedAt: '2026-10-13T14:00:00Z', ...overrides,
  };
}

function decision(kind: ProgramDecision['kind'], createdAt: string): ProgramDecision {
  return { id: kind, programId: program.id, kind, detail: 'Decisión registrada', createdAt };
}

describe('día pendiente de la rutina', () => {
  it('empieza en Día 1 sin depender del calendario', () => {
    expect(routineSequence(program.id, days, [])).toEqual({ nextDayId: 'upper-a', nextDayNumber: 1, completedCount: 0, latestCompleted: null });
  });

  it('parciales, activas y descartadas no avanzan ni cuentan como completas', () => {
    const statuses: WorkoutSession['status'][] = ['partial', 'active', 'discarded'];
    const records = statuses.map((status, i) => session({ id: `s${i}`, status }));
    expect(routineSequence(program.id, days, records)).toMatchObject({ nextDayId: 'upper-a', completedCount: 0 });
  });

  it('una completa avanza al próximo día; el cuarto vuelve al primero', () => {
    expect(routineSequence(program.id, days, [session()])).toMatchObject({ nextDayId: 'lower-a', nextDayNumber: 2, completedCount: 1 });
    expect(routineSequence(program.id, days, [session({ dayId: 'lower-b' })])).toMatchObject({ nextDayId: 'upper-a', nextDayNumber: 1 });
  });

  it('continúa después de la última completa del historial previo aunque no estuviera en orden', () => {
    const older = session({ id: 'old', dayId: 'lower-b', startedAt: '2026-10-01T13:00:00Z' });
    const latest = session({ id: 'new', dayId: 'lower-a' });
    expect(routineSequence(program.id, days, [latest, older])).toMatchObject({ nextDayId: 'upper-b', completedCount: 2, latestCompleted: latest });
  });

  it('ignora programas ajenos, sesiones libres y días eliminados', () => {
    const records = [session({ programId: 'other' }), session({ programId: null }), session({ dayId: 'deleted' }), session({ dayId: null })];
    expect(routineSequence(program.id, days, records)).toMatchObject({ nextDayId: 'upper-a', completedCount: 0 });
  });

  it('ordena instantes con distintos desfases y desempata sin mutar los datos', () => {
    const first = session({ id: 'a', dayId: 'upper-a', startedAt: '2026-10-13T11:00:00-03:00' });
    const second = session({ id: 'b', dayId: 'lower-a', startedAt: '2026-10-13T13:30:00-01:00' });
    const records = [second, first];
    expect(routineSequence(program.id, days, records).nextDayId).toBe('upper-b');
    expect(records).toEqual([second, first]);
    expect(routineSequence(program.id, days, [session({ id: 'b', dayId: 'lower-a' }), session({ id: 'a' })]).nextDayId).toBe('upper-b');
  });

  it('sin días vigentes no propone una sesión inexistente', () => {
    expect(routineSequence(program.id, [], [session()])).toMatchObject({ nextDayId: null, nextDayNumber: null, completedCount: 0 });
  });
});

describe('adaptación basada en entrenamientos completos', () => {
  function state(sessions: WorkoutSession[], decisions: ProgramDecision[] = [], today = '2026-12-20') {
    return sequenceAdaptationState({ program, daysPerWeek: 4, today, sessions, decisions });
  }
  const eight = Array.from({ length: 8 }, (_, i) => session({ id: `s${i}` }));

  it('meses sin entrenar no terminan adaptación ni piden una decisión por calendario', () => {
    expect(state([])).toMatchObject({ active: true, pendingDecision: false });
    expect(state([]).reason).toContain('0 de 8');
  });

  it('las parciales cuentan como actividad pero no cumplen el objetivo', () => {
    expect(state(eight.map(item => ({ ...item, status: 'partial' })))).toMatchObject({ active: true, pendingDecision: false });
  });

  it('ocho completas ofrecen el cambio sin subir el volumen en silencio', () => {
    expect(state(eight)).toMatchObject({ active: true, pendingDecision: true });
    expect(state(eight, [decision('end-adaptation', '2026-10-13T15:00:00Z')], '2026-10-14')).toMatchObject({ active: false, pendingDecision: false });
  });

  it('respeta una decisión explícita previa y una extensión posterior', () => {
    const ended = decision('end-adaptation', '2026-10-13T15:00:00Z');
    expect(state([session()], [ended], '2026-10-14').active).toBe(false);
    expect(state([session()], [ended, decision('keep-adaptation', '2026-10-14T15:00:00Z')], '2026-10-15').active).toBe(true);
  });

  it('una decisión ajena no afecta la fase', () => {
    expect(state([], [{ ...decision('end-adaptation', '2026-10-13T15:00:00Z'), programId: 'other' }]).active).toBe(true);
  });

  it('ofrece volver a adaptación tras 14 días, sin usar una decisión anterior al hueco', () => {
    expect(state(eight, [decision('end-adaptation', '2026-10-13T15:00:00Z')], '2026-10-27')).toMatchObject({ active: false, pendingDecision: true });
    expect(state(eight, [decision('end-adaptation', '2026-10-28T01:00:00Z')], '2026-10-27')).toMatchObject({ active: false, pendingDecision: false });
  });

  it('una parcial reciente evita un falso aviso de inactividad', () => {
    expect(state([...eight, session({ id: 'partial', status: 'partial', localDate: '2026-10-26' })], [decision('end-adaptation', '2026-10-13T15:00:00Z')], '2026-10-27')).toMatchObject({ active: false, pendingDecision: false });
  });

  it('un programa sin adaptación no inventa un período obligatorio', () => {
    expect(sequenceAdaptationState({ program: { ...program, adaptationWeeks: 0 }, daysPerWeek: 4, today: '2026-10-13', sessions: [], decisions: [] })).toMatchObject({ active: false, pendingDecision: false });
  });
});
