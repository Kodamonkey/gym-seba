import { beforeEach, describe, expect, it } from 'vitest';
import { computePRs, eventsForSet } from '../domain/pr';
import { applyImport, canonical, exportBackup, parseBackup, previewImport } from './backup';
import { ConflictError, db } from './db';
import { changeRecurrence, createProgram, moveScheduledWorkout, setSkipped, startScheduledWorkout } from './program';
import { ensureSeeded } from './seed';
import {
  addSet,
  confirmSet,
  finishSession,
  liveSetsOf,
  prEntries,
  setUnilateralLogging,
  substituteVariant,
  updateSet,
} from './sessions';

/** Pruebas de regresión de la revisión de código (etapa D). */

const TZ = 'America/Santiago';

async function fresh() {
  await db.delete();
  await db.open();
  await ensureSeeded();
  const program = await createProgram({ templateId: 'rt-atlas-4d', startDate: '2026-10-12', timeZone: TZ });
  const sws = await db.scheduledWorkouts.where('programId').equals(program.id).sortBy('date');
  return { program, sws };
}

async function exercisesOf(sessionId: string) {
  return db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
}

let ctx: Awaited<ReturnType<typeof fresh>>;
beforeEach(async () => {
  ctx = await fresh();
});

describe('sesiones', () => {
  it('no permite iniciar otra vez una sesión planificada que ya tiene registro', async () => {
    const s = await startScheduledWorkout(ctx.sws[0]!.id, TZ);
    await finishSession(s.id, 'partial');
    await expect(startScheduledWorkout(ctx.sws[0]!.id, TZ)).rejects.toThrow(/ya tiene un registro/);
  });

  it('confirmar de nuevo con otros valores no se da por guardado en silencio', async () => {
    const s = await startScheduledWorkout(ctx.sws[0]!.id, TZ);
    const set = (await liveSetsOf((await exercisesOf(s.id))[0]!.id))[0]!;
    await confirmSet(set.id, { load: 40, reps: 10 }, set.rev);
    await expect(confirmSet(set.id, { load: 40, reps: 10 }, set.rev)).resolves.toMatchObject({ load: 40 });
    await expect(confirmSet(set.id, { load: 45, reps: 10 }, set.rev)).rejects.toBeInstanceOf(ConflictError);
    expect((await db.setLogs.get(set.id))?.load).toBe(40);
  });

  it('no cambia el modo de lados si hay valores escritos sin confirmar', async () => {
    const s = await startScheduledWorkout(ctx.sws[1]!.id, TZ);
    const pallof = (await exercisesOf(s.id)).find((x) => x.variantId === 'v-pallof-press')!;
    const set = (await liveSetsOf(pallof.id))[0]!;
    await updateSet(set.id, { load: 10 }, set.rev);
    await expect(setUnilateralLogging(pallof.id, 'per-side-rows')).rejects.toThrow(/sin confirmar/);
    expect((await db.setLogs.get(set.id))?.load).toBe(10);
  });

  it('sustituir con filas por lado cuenta series, no filas, y es idempotente', async () => {
    const s = await startScheduledWorkout(ctx.sws[1]!.id, TZ);
    const pallof = (await exercisesOf(s.id)).find((x) => x.variantId === 'v-pallof-press')!;
    await setUnilateralLogging(pallof.id, 'per-side-rows');
    const rows = await liveSetsOf(pallof.id);
    // Una serie completa = filas izquierda y derecha.
    await confirmSet(rows[0]!.id, { load: 10, reps: 10 }, rows[0]!.rev);
    await confirmSet(rows[1]!.id, { load: 10, reps: 10 }, rows[1]!.rev);
    const a = await substituteVariant(pallof.id, 'v-pallof-hold');
    const b = await substituteVariant(pallof.id, 'v-pallof-hold');
    expect(a).toBe(b);
    const added = (await db.sessionExercises.get(a))!;
    expect(added.prescribed.sets).toBe(pallof.prescribed.sets - 1);
    expect((await exercisesOf(s.id)).filter((x) => x.variantId === 'v-pallof-hold')).toHaveLength(1);
  });
});

describe('PR', () => {
  it('una serie añadida tarde a una sesión pasada conserva su lugar cronológico', async () => {
    const s1 = await startScheduledWorkout(ctx.sws[0]!.id, TZ);
    const se1 = (await exercisesOf(s1.id))[0]!;
    const a = (await liveSetsOf(se1.id))[0]!;
    await confirmSet(a.id, { load: 40, reps: 10 }, a.rev);
    await finishSession(s1.id, 'partial');
    // La sesión 2 empieza después.
    await new Promise((r) => setTimeout(r, 5));
    const s2 = await startScheduledWorkout(ctx.sws[4]!.id, TZ);
    const se2 = (await exercisesOf(s2.id))[0]!;
    const b = (await liveSetsOf(se2.id))[0]!;
    await confirmSet(b.id, { load: 50, reps: 10 }, b.rev);
    await finishSession(s2.id, 'partial');
    // Corrección tardía en la sesión 1 con una carga mayor que la de la sesión 2.
    const late = await addSet(se1.id, 'work');
    await confirmSet(late.id, { load: 55, reps: 10 }, late.rev);
    const r = computePRs(await prEntries());
    // En orden de sesiones: 40 (s1) → 55 (s1, corrección) → 50 (s2) no es récord.
    expect(eventsForSet(r, late.id).find((e) => e.type === 'max-load')?.status).toBe('new');
    expect(eventsForSet(r, b.id).some((e) => e.type === 'max-load')).toBe(false);
  });
});

describe('respaldo', () => {
  it('la comparación detecta diferencias anidadas', () => {
    expect(canonical({ a: 1, p: { sets: 2 } })).not.toBe(canonical({ a: 1, p: { sets: 3 } }));
    expect(canonical({ b: 1, a: [{ y: 1, x: 2 }] })).toBe(canonical({ a: [{ x: 2, y: 1 }], b: 1 }));
  });

  it('un cambio anidado (prescripción) cuenta como conflicto, no como idéntico', async () => {
    await startScheduledWorkout(ctx.sws[0]!.id, TZ);
    const backup = await exportBackup();
    const se = backup.tables.sessionExercises![0] as { prescribed: { sets: number } };
    se.prescribed.sets = 9;
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.errors.join());
    expect((await previewImport(parsed.data)).tables.sessionExercises?.conflicts).toBe(1);
  });

  it('la vista previa de "reemplazar todo" informa lo que se eliminará', async () => {
    const backup = await exportBackup();
    backup.tables.scheduledWorkouts = backup.tables.scheduledWorkouts!.slice(0, 5);
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.errors.join());
    const p = await previewImport(parsed.data, 'replace-all');
    expect(p.tables.scheduledWorkouts?.removed).toBe(27);
  });

  it('valida todas las tablas (no solo el id)', async () => {
    const backup = await exportBackup();
    (backup.tables.variants![0] as Record<string, unknown>).loadConvention = 'inventada';
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(false);
  });

  it('nunca deja dos sesiones en curso', async () => {
    const s = await startScheduledWorkout(ctx.sws[0]!.id, TZ);
    const backup = await exportBackup();
    const other = structuredClone(backup.tables.sessions![0]!) as Record<string, unknown>;
    other.id = 'otra-sesion';
    backup.tables.sessions = [other];
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.errors.join());
    await expect(applyImport(parsed.data, 'merge-skip')).rejects.toThrow(/dos sesiones en curso/);
    expect(await db.sessions.count()).toBe(1);
    expect((await db.sessions.get(s.id))?.status).toBe('active');

    const two = await exportBackup();
    two.tables.sessions = [backup.tables.sessions[0]!, { ...(two.tables.sessions![0] as object) }];
    expect(parseBackup(JSON.stringify(two)).ok).toBe(false);
  });
});

describe('calendario', () => {
  it('"esta y las futuras" respeta sesiones movidas a mano u omitidas', async () => {
    const mondays = ctx.sws.filter((x) => x.dayId === 'day-upper-a');
    await moveScheduledWorkout(mondays[2]!.id, '2026-10-28');
    await setSkipped(mondays[3]!.id, true);
    await changeRecurrence(mondays[0]!.id, '2026-10-13', 'this-and-future');
    const after = await db.scheduledWorkouts.where('programId').equals(ctx.program.id).toArray();
    expect(after.find((x) => x.id === mondays[2]!.id)?.date).toBe('2026-10-28');
    expect(after.find((x) => x.id === mondays[3]!.id)?.skippedConfirmed).toBe(true);
  });
});
