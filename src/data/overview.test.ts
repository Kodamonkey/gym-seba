import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import { ensureProgram, lastPerformanceByVariant, sessionSummary, startDay } from './overview';
import { ensureSeeded } from './seed';
import { startScheduledWorkout } from './program';
import { applyImport, exportBackup } from './backup';
import { ActiveSessionExistsError, confirmSet, discardSession, finishSession, liveSetsOf } from './sessions';

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

async function complete(sessionId: string) {
  const exercises = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
  for (const exercise of exercises) {
    for (const set of await liveSetsOf(exercise.id)) {
      await confirmSet(set.id, exercise.variant.measure === 'time'
        ? { durationSec: exercise.prescribed.durationMin! }
        : { load: 10, reps: exercise.prescribed.repMax }, set.rev);
    }
  }
  return finishSession(sessionId, 'completed');
}

describe('ensureProgram', () => {
  it('creado un domingo, empieza ese mismo día local', async () => {
    at('2026-10-11T15:00:00-03:00');
    await ensureProgram();
    const p = await db.programs.where('status').equals('active').first();
    expect(p?.startDate).toBe('2026-10-11');
  });

  it('creado un miércoles, empieza ese mismo día local', async () => {
    at('2026-10-14T10:00:00-03:00');
    await ensureProgram();
    const p = await db.programs.where('status').equals('active').first();
    expect(p?.startDate).toBe('2026-10-14');
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
  it('inicia el Día 1 sin modificar las fechas o vínculos planificados anteriores', async () => {
    at('2026-10-12T10:00:00-03:00');
    await ensureProgram();
    const planned = await db.scheduledWorkouts.toArray();
    const s = await startDay('day-upper-a', TZ);
    expect(s.scheduledWorkoutId).toBeNull();
    expect(s.programWeek).toBeNull();
    expect(s.localDate).toBe('2026-10-12');
    expect(s.title).toBe('Tren superior A');
    expect(await db.scheduledWorkouts.toArray()).toEqual(planned);
  });

  it('antes de la fecha inicial antigua permite entrenar el Día 1', async () => {
    at('2026-10-11T10:00:00-03:00');
    await ensureProgram();
    const program = (await db.programs.where('status').equals('active').first())!;
    await db.programs.update(program.id, { startDate: '2026-10-12' });
    const s = await startDay('day-upper-a', TZ);
    expect(s.scheduledWorkoutId).toBeNull();
    expect(s.dayId).toBe('day-upper-a');
    expect(s.localDate).toBe('2026-10-11');
  });

  it('rechaza saltar días y avanza solo al completar la sesión', async () => {
    at('2026-10-12T10:00:00-03:00');
    await ensureProgram();
    await expect(startDay('day-lower-a', TZ)).rejects.toThrow('Primero completa el Día 1');
    expect(await db.sessions.count()).toBe(0);
    const first = await startDay('day-upper-a', TZ);
    await complete(first.id);
    await expect(startDay('day-upper-b', TZ)).rejects.toThrow('Primero completa el Día 2');
    const second = await startDay('day-lower-a', TZ);
    expect(second.dayId).toBe('day-lower-a');
  });

  it('las ausencias, parciales y descartadas mantienen el mismo día y conservan las series', async () => {
    at('2026-10-12T10:00:00-03:00');
    await ensureProgram();
    const first = await startDay('day-upper-a', TZ);
    const se = (await db.sessionExercises.where('sessionId').equals(first.id).first())!;
    const set = (await liveSetsOf(se.id))[0]!;
    await confirmSet(set.id, { load: 30, reps: 10 }, set.rev);
    const partial = await finishSession(first.id, 'partial');
    const logs = await db.setLogs.where('sessionId').equals(first.id).toArray();
    at('2027-03-20T10:00:00-03:00');
    await expect(startDay('day-lower-a', TZ)).rejects.toThrow('Primero completa el Día 1');
    const repeated = await startDay('day-upper-a', TZ);
    expect(repeated.adaptation).toBe(true);
    await discardSession(repeated.id);
    const next = await startDay('day-upper-a', TZ);
    expect(next.dayId).toBe('day-upper-a');
    expect(await db.sessions.get(first.id)).toEqual(partial);
    expect(await db.setLogs.where('sessionId').equals(first.id).toArray()).toEqual(logs);
  });

  it('completar el Día 4 vuelve al Día 1, sin depender del calendario', async () => {
    at('2026-10-12T10:00:00-03:00');
    await ensureProgram();
    const days = ['day-upper-a', 'day-lower-a', 'day-upper-b', 'day-lower-b'];
    for (const [i, dayId] of days.entries()) {
      at(`2026-10-${12 + i}T10:00:00-03:00`);
      await complete((await startDay(dayId, TZ)).id);
    }
    at('2027-01-18T10:00:00-03:00');
    expect((await startDay('day-upper-a', TZ)).dayId).toBe('day-upper-a');
  });

  it('continúa tras la última completa de un historial previo fuera de orden sin reescribirlo', async () => {
    at('2026-10-12T10:00:00-03:00');
    await ensureProgram();
    const program = (await db.programs.where('status').equals('active').first())!;
    const sw = (await db.scheduledWorkouts.where('programId').equals(program.id).toArray())
      .find((s) => s.dayId === 'day-upper-b')!;
    const legacy = await complete((await startScheduledWorkout(sw.id, TZ)).id);
    const planned = await db.scheduledWorkouts.toArray();
    const exercises = await db.sessionExercises.where('sessionId').equals(legacy.id).toArray();
    const logs = await db.setLogs.where('sessionId').equals(legacy.id).toArray();
    at('2026-11-01T10:00:00-03:00');
    const next = await startDay('day-lower-b', TZ);
    expect(next.scheduledWorkoutId).toBeNull();
    expect(await db.programs.get(program.id)).toEqual(program);
    expect(await db.sessions.get(legacy.id)).toEqual(legacy);
    expect(await db.sessionExercises.where('sessionId').equals(legacy.id).toArray()).toEqual(exercises);
    expect(await db.setLogs.where('sessionId').equals(legacy.id).toArray()).toEqual(logs);
    expect(await db.scheduledWorkouts.toArray()).toEqual(planned);
  });

  it('dos inicios simultáneos crean una sesión; una activa tiene prioridad sobre validar el día', async () => {
    at('2026-10-12T10:00:00-03:00');
    await ensureProgram();
    const results = await Promise.allSettled([startDay('day-upper-a', TZ), startDay('day-upper-a', TZ)]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(ActiveSessionExistsError);
    expect(await db.sessions.count()).toBe(1);
    expect(await db.sessions.where('status').equals('active').count()).toBe(1);
    await expect(startDay('day-lower-b', TZ)).rejects.toBeInstanceOf(ActiveSessionExistsError);
  });

  it('el respaldo restaura el día pendiente desde completas y parciales sin un cursor en meta', async () => {
    at('2026-10-12T10:00:00-03:00');
    await ensureProgram();
    const first = await complete((await startDay('day-upper-a', TZ)).id);
    at('2026-10-13T10:00:00-03:00');
    const second = await startDay('day-lower-a', TZ);
    const se = (await db.sessionExercises.where('sessionId').equals(second.id).first())!;
    const set = (await liveSetsOf(se.id))[0]!;
    await confirmSet(set.id, { load: 40, reps: 10 }, set.rev);
    const partial = await finishSession(second.id, 'partial');
    const backup = await exportBackup();
    const logs = await db.setLogs.where('sessionId').equals(second.id).toArray();

    await db.delete();
    await db.open();
    await ensureSeeded();
    await applyImport(backup, 'replace-all');
    at('2027-02-20T10:00:00-03:00');
    await expect(startDay('day-upper-b', TZ)).rejects.toThrow('Primero completa el Día 2');
    expect((await startDay('day-lower-a', TZ)).dayId).toBe('day-lower-a');
    expect(await db.sessions.get(first.id)).toEqual(first);
    expect(await db.sessions.get(second.id)).toEqual(partial);
    expect(await db.setLogs.where('sessionId').equals(second.id).toArray()).toEqual(logs);
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
