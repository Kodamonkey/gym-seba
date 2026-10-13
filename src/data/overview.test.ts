import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import { ensureProgram, lastPerformanceByVariant, sessionSummary, startDay } from './overview';
import { ensureSeeded } from './seed';
import { confirmSet, finishSession, liveSetsOf } from './sessions';

const TZ = 'America/Santiago';

/** Solo se falsea la fecha: IndexedDB en memoria necesita los temporizadores reales. */
function at(iso: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(iso));
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await ensureSeeded();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ensureProgram', () => {
  it('creado un domingo, empieza el lunes siguiente', async () => {
    at('2026-10-11T15:00:00-03:00');
    await ensureProgram();
    const p = await db.programs.where('status').equals('active').first();
    expect(p?.startDate).toBe('2026-10-12');
  });

  it('creado un miércoles, empieza el lunes de esa semana', async () => {
    at('2026-10-14T10:00:00-03:00');
    await ensureProgram();
    const p = await db.programs.where('status').equals('active').first();
    expect(p?.startDate).toBe('2026-10-12');
  });

  it('es idempotente y da el perfil por configurado', async () => {
    at('2026-10-12T10:00:00-03:00');
    await Promise.all([ensureProgram(), ensureProgram()]);
    await ensureProgram();
    expect(await db.programs.count()).toBe(1);
    expect((await db.profile.get('me'))?.onboardedAt).not.toBeNull();
  });
});

describe('startDay', () => {
  it('usa la sesión planificada de esa semana aunque sea otro día', async () => {
    at('2026-10-12T10:00:00-03:00');
    await ensureProgram();
    const s = await startDay('day-lower-a', TZ);
    const sw = await db.scheduledWorkouts.get(s.scheduledWorkoutId!);
    expect(sw?.date).toBe('2026-10-13');
    expect(sw?.sessionId).toBe(s.id);
    expect(s.title).toBe('Tren inferior A');
  });

  it('antes de que empiece el programa inicia una sesión libre', async () => {
    at('2026-10-11T10:00:00-03:00');
    await ensureProgram();
    const s = await startDay('day-upper-a', TZ);
    expect(s.scheduledWorkoutId).toBeNull();
    expect(s.dayId).toBe('day-upper-a');
  });
});

describe('historial', () => {
  it('devuelve la última sesión registrada de cada variante y su resumen', async () => {
    at('2026-10-12T10:00:00-03:00');
    await ensureProgram();
    const s = await startDay('day-upper-a', TZ);
    const se = (await db.sessionExercises.where('sessionId').equals(s.id).sortBy('order'))[0]!;
    const [first] = await liveSetsOf(se.id);
    await confirmSet(first!.id, { load: 40, reps: 12 }, first!.rev);
    await finishSession(s.id, 'partial');

    const last = await lastPerformanceByVariant([se.variantId, 'v-leg-press']);
    expect(last.get(se.variantId)?.sets.map((x) => [x.load, x.reps])).toEqual([[40, 12]]);
    expect(last.has('v-leg-press')).toBe(false);

    const summary = await sessionSummary(s.id);
    expect(summary?.doneSets).toBe(1);
    expect(summary?.exercises[0]?.sets).toHaveLength(1);
  });
});
