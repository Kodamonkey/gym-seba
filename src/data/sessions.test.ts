import { beforeEach, describe, expect, it } from 'vitest';
import { computePRs } from '../domain/pr';
import { AtlasDB, ConflictError, db } from './db';
import { createProgram, saveTemplate, startScheduledWorkout } from './program';
import { ensureSeeded } from './seed';
import {
  ActiveSessionExistsError,
  addSet,
  confirmSet,
  deleteSet,
  finishSession,
  liveSetsOf,
  prEntries,
  previousComparable,
  sessionCompleteness,
  setUnilateralLogging,
  substituteVariant,
  updateSet,
} from './sessions';

const TZ = 'America/Santiago';

async function freshStart() {
  await db.delete();
  await db.open();
  await ensureSeeded();
  const program = await createProgram({ templateId: 'rt-atlas-4d', startDate: '2026-10-12', timeZone: TZ });
  const sws = await db.scheduledWorkouts.where('programId').equals(program.id).sortBy('date');
  return { program, sws };
}

async function firstSetOf(sessionId: string) {
  const ses = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
  const sets = await liveSetsOf(ses[0]!.id);
  return { se: ses[0]!, set: sets[0]! };
}

beforeEach(async () => {
  await freshStart();
});

describe('siembra', () => {
  it('no crea historial, sesiones ni mediciones', async () => {
    expect(await db.sessions.count()).toBe(0);
    expect(await db.setLogs.count()).toBe(0);
    expect(await db.bodyMeasurements.count()).toBe(0);
    expect(await db.variants.count()).toBe(39);
  });

  it('es idempotente', async () => {
    await ensureSeeded();
    expect(await db.variants.count()).toBe(39);
  });
});

describe('sesión activa', () => {
  it('registra una serie y la recupera tras "recargar" (nueva conexión)', async () => {
    const { sws } = await freshStart();
    const s = await startScheduledWorkout(sws[0]!.id, TZ);
    const { set } = await firstSetOf(s.id);
    const draft = await updateSet(set.id, { load: 40, reps: 10 }, set.rev);
    await confirmSet(set.id, { load: 40, reps: 10, rir: 2 }, draft.rev);

    const reopened = new AtlasDB('atlas');
    await reopened.open();
    const persisted = await reopened.setLogs.get(set.id);
    expect(persisted).toMatchObject({ load: 40, reps: 10, rir: 2, status: 'completed' });
    expect(persisted?.completedAt).not.toBeNull();
    reopened.close();
  });

  it('impide dos sesiones activas', async () => {
    const { sws } = await freshStart();
    await startScheduledWorkout(sws[0]!.id, TZ);
    await expect(startScheduledWorkout(sws[1]!.id, TZ)).rejects.toBeInstanceOf(ActiveSessionExistsError);
  });

  it('aplica la adaptación (2 series) en la semana 1', async () => {
    const { sws } = await freshStart();
    const s = await startScheduledWorkout(sws[0]!.id, TZ);
    const ses = await db.sessionExercises.where('sessionId').equals(s.id).toArray();
    expect(ses.every((x) => x.prescribed.sets === 2)).toBe(true);
  });

  it('el doble toque no duplica ni re-escribe', async () => {
    const { sws } = await freshStart();
    const s = await startScheduledWorkout(sws[0]!.id, TZ);
    const { set } = await firstSetOf(s.id);
    const [a, b] = await Promise.all([
      confirmSet(set.id, { load: 40, reps: 10 }, set.rev),
      confirmSet(set.id, { load: 40, reps: 10 }, set.rev),
    ]);
    expect(a.id).toBe(b.id);
    expect(a.completedAt).toBe(b.completedAt);
    expect((await db.setLogs.where('sessionId').equals(s.id).toArray()).length).toBe(
      (await sessionCompleteness(s.id)).expected,
    );
  });

  it('detecta ediciones concurrentes en lugar de sobrescribir', async () => {
    const { sws } = await freshStart();
    const s = await startScheduledWorkout(sws[0]!.id, TZ);
    const { set } = await firstSetOf(s.id);
    await updateSet(set.id, { load: 40 }, set.rev);
    await expect(updateSet(set.id, { load: 50 }, set.rev)).rejects.toBeInstanceOf(ConflictError);
    expect((await db.setLogs.get(set.id))?.load).toBe(40);
  });

  it('duplicar copia valores pero no el estado ni la fecha', async () => {
    const { sws } = await freshStart();
    const s = await startScheduledWorkout(sws[0]!.id, TZ);
    const { se, set } = await firstSetOf(s.id);
    const done = await confirmSet(set.id, { load: 40, reps: 10 }, set.rev);
    const copy = await addSet(se.id, 'work', done.id);
    expect(copy).toMatchObject({ load: 40, reps: 10, status: 'draft', completedAt: null });
  });

  it('finalizar no marca como realizadas las series pendientes', async () => {
    const { sws } = await freshStart();
    const s = await startScheduledWorkout(sws[0]!.id, TZ);
    const { set } = await firstSetOf(s.id);
    await confirmSet(set.id, { load: 40, reps: 10 }, set.rev);
    await finishSession(s.id, 'partial');
    const all = await db.setLogs.where('sessionId').equals(s.id).toArray();
    expect(all.filter((x) => x.status === 'completed')).toHaveLength(1);
    expect((await db.sessions.get(s.id))?.status).toBe('partial');
  });
});

describe('plantilla vs sesión', () => {
  it('editar la plantilla no altera sesiones anteriores', async () => {
    const { sws } = await freshStart();
    const s = await startScheduledWorkout(sws[0]!.id, TZ);
    const before = await db.sessionExercises.where('sessionId').equals(s.id).toArray();
    const tpl = (await db.routineTemplates.get('rt-atlas-4d'))!;
    tpl.days[0]!.exercises[0]!.sets = 5;
    tpl.days[0]!.exercises[0]!.repMax = 20;
    await saveTemplate(tpl);
    const after = await db.sessionExercises.where('sessionId').equals(s.id).toArray();
    expect(after.map((x) => x.prescribed)).toEqual(before.map((x) => x.prescribed));
    expect((await db.routineTemplates.get('rt-atlas-4d'))?.version).toBe(2);
  });
});

describe('sustituciones y lateralidad', () => {
  it('sustituir sin series confirmadas no transfiere cargas', async () => {
    const { sws } = await freshStart();
    const s = await startScheduledWorkout(sws[0]!.id, TZ);
    const { se, set } = await firstSetOf(s.id);
    await updateSet(set.id, { load: 60 }, set.rev);
    await substituteVariant(se.id, 'v-db-bench-press');
    const updated = (await db.sessionExercises.get(se.id))!;
    expect(updated.variantId).toBe('v-db-bench-press');
    expect(updated.variant.loadConvention).toBe('per-implement');
    const sets = await liveSetsOf(se.id);
    expect(sets.every((x) => x.load === null)).toBe(true);
  });

  it('sustituir con series confirmadas añade la alternativa aparte', async () => {
    const { sws } = await freshStart();
    const s = await startScheduledWorkout(sws[0]!.id, TZ);
    const { se, set } = await firstSetOf(s.id);
    await confirmSet(set.id, { load: 60, reps: 10 }, set.rev);
    const newId = await substituteVariant(se.id, 'v-db-bench-press');
    expect(newId).not.toBe(se.id);
    expect((await db.sessionExercises.get(se.id))?.variantId).toBe('v-chest-press-machine');
    expect((await liveSetsOf(newId)).length).toBe(1);
  });

  it('cambia a filas por lado solo sin series confirmadas', async () => {
    const { sws } = await freshStart();
    // Martes: Pallof press (unilateral) es el sexto ejercicio.
    const s = await startScheduledWorkout(sws[1]!.id, TZ);
    const ses = await db.sessionExercises.where('sessionId').equals(s.id).sortBy('order');
    const pallof = ses.find((x) => x.variantId === 'v-pallof-press')!;
    await setUnilateralLogging(pallof.id, 'per-side-rows');
    const sets = await liveSetsOf(pallof.id);
    expect(sets.map((x) => x.side)).toEqual(['left', 'right', 'left', 'right']);
  });
});

describe('historial y PR', () => {
  it('excluye calentamientos, borradores y series borradas', async () => {
    const { sws } = await freshStart();
    const s = await startScheduledWorkout(sws[0]!.id, TZ);
    const { se, set } = await firstSetOf(s.id);
    await confirmSet(set.id, { load: 40, reps: 10 }, set.rev);
    const warm = await addSet(se.id, 'warmup');
    await confirmSet(warm.id, { load: 100, reps: 10 }, warm.rev);
    const extra = await addSet(se.id, 'work');
    const extraDone = await confirmSet(extra.id, { load: 90, reps: 10 }, extra.rev);
    await deleteSet(extraDone.id);
    const entries = await prEntries();
    expect(entries.map((e) => e.loadKg)).toEqual([40]);
    const r = computePRs(entries);
    expect(r.bests.find((b) => b.type === 'max-load')?.value).toBe(40);
  });

  it('el registro anterior solo considera la misma máquina', async () => {
    const { sws } = await freshStart();
    const s1 = await startScheduledWorkout(sws[0]!.id, TZ);
    const { set } = await firstSetOf(s1.id);
    await confirmSet(set.id, { load: 40, reps: 10 }, set.rev);
    await finishSession(s1.id, 'partial');
    const s2 = await startScheduledWorkout(sws[4]!.id, TZ);
    const { se } = await firstSetOf(s2.id);
    const prev = await previousComparable(se);
    expect(prev?.sets[0]?.load).toBe(40);
    expect(prev?.confirmed).toBe(false); // máquina sin identificar
  });
});
