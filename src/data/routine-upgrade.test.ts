import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyImport, exportBackup, parseBackup } from './backup';
import { db } from './db';
import { startDay } from './overview';
import { createProgram, moveScheduledWorkout, recordDecision, startScheduledWorkout } from './program';
import { IMPORTED_ROUTINES_KEY } from './routine-ownership';
import { upgradeRoutine } from './routine-upgrade';
import { ensureSeeded } from './seed';
import { ROUTINE_TEMPLATE } from './seed/routine';
import { ROUTINE_TEMPLATE_V1 } from './seed/routine-v1';
import { confirmSet, finishSession, liveSetsOf } from './sessions';

const TZ = 'America/Santiago';
const TEMPLATE_ID = ROUTINE_TEMPLATE_V1.id;

async function installLegacy(withSnapshot = true) {
  await db.routineTemplates.put(structuredClone(ROUTINE_TEMPLATE_V1));
  await db.routineVersions.clear();
  if (withSnapshot) {
    await db.routineVersions.add({
      id: `${TEMPLATE_ID}@1`, templateId: TEMPLATE_ID, version: 1,
      snapshot: structuredClone(ROUTINE_TEMPLATE_V1), createdAt: ROUTINE_TEMPLATE_V1.createdAt,
    });
  }
  await db.meta.put({ key: 'seedVersion', value: 1 });
}

async function legacySession() {
  const program = await createProgram({ templateId: TEMPLATE_ID, startDate: '2026-10-12', timeZone: TZ });
  const workouts = await db.scheduledWorkouts.where('programId').equals(program.id).sortBy('date');
  const session = await startScheduledWorkout(workouts[0]!.id, TZ);
  const exercise = (await db.sessionExercises.where('sessionId').equals(session.id).sortBy('order'))[0]!;
  const set = (await liveSetsOf(exercise.id))[0]!;
  await confirmSet(set.id, { load: 40, reps: 10, rir: 2 }, set.rev);
  return { program, workouts, session, exercise, set };
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-12T12:00:00-03:00'));
  await db.delete();
  await db.open();
  await ensureSeeded();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('actualización de la rutina original', () => {
  it('una instalación nueva guarda la versión actual con su snapshot correcto', async () => {
    expect(ROUTINE_TEMPLATE.version).toBe(2);
    expect(await db.routineTemplates.get(TEMPLATE_ID)).toEqual(ROUTINE_TEMPLATE);
    expect(await db.routineVersions.get(`${TEMPLATE_ID}@2`)).toMatchObject({ version: 2, snapshot: ROUTINE_TEMPLATE });
    expect((await db.meta.get('seedVersion'))?.value).toBe(2);
    expect(await upgradeRoutine()).toBe('current');
  });

  it('actualiza la original sin cambiar el historial, las fechas ni decisiones del programa', async () => {
    await installLegacy();
    const { program, workouts, session } = await legacySession();
    await finishSession(session.id, 'partial');
    await moveScheduledWorkout(workouts[1]!.id, '2026-10-14');
    await db.programs.update(program.id, { adaptationWeeks: 3 });
    await recordDecision(program.id, 'keep-adaptation', 'Conservar adaptación tres semanas.');
    const before = await exportBackup();

    await ensureSeeded();
    const after = await exportBackup();
    const { routineTemplates: _beforeTemplates, routineVersions: _beforeVersions, ...beforeRecords } = before.tables;
    const { routineTemplates: _afterTemplates, routineVersions: _afterVersions, ...afterRecords } = after.tables;
    expect(afterRecords).toEqual(beforeRecords);
    expect((await db.routineTemplates.get(TEMPLATE_ID))?.days).toEqual(ROUTINE_TEMPLATE.days);
    expect((await db.routineVersions.get(`${TEMPLATE_ID}@1`))?.snapshot).toEqual(ROUTINE_TEMPLATE_V1);
    expect((await db.routineVersions.get(`${TEMPLATE_ID}@2`))?.snapshot.version).toBe(2);
    expect((await db.meta.get(`routineUpgrade:${TEMPLATE_ID}@2`))?.value).toMatchObject({ state: 'applied' });
  });

  it('difiere durante una sesión activa y el próximo inicio aplica la nueva rutina', async () => {
    await installLegacy();
    const { session } = await legacySession();
    const before = (await exportBackup()).tables;
    expect(await upgradeRoutine()).toBe('deferred-active');
    await ensureSeeded();
    expect((await exportBackup()).tables).toEqual(before);
    expect((await db.routineTemplates.get(TEMPLATE_ID))?.version).toBe(1);

    await finishSession(session.id, 'partial');
    const historicalExercises = await db.sessionExercises.where('sessionId').equals(session.id).toArray();
    const historicalSets = await db.setLogs.where('sessionId').equals(session.id).toArray();
    const next = await startDay('day-upper-a', TZ);
    const nextExercises = await db.sessionExercises.where('sessionId').equals(next.id).sortBy('order');
    expect((await db.routineTemplates.get(TEMPLATE_ID))?.version).toBe(2);
    expect(nextExercises[0]?.variantId).toBe(ROUTINE_TEMPLATE.days[0]!.exercises[0]!.variantId);
    expect(nextExercises[0]?.prescribed.restSec).toBe(ROUTINE_TEMPLATE.days[0]!.exercises[0]!.restSec);
    expect(await db.sessionExercises.where('sessionId').equals(session.id).toArray()).toEqual(historicalExercises);
    expect(await db.setLogs.where('sessionId').equals(session.id).toArray()).toEqual(historicalSets);
  });

  it('preserva una plantilla editada aunque conserve el ID y la versión 1', async () => {
    await installLegacy();
    const edited = structuredClone(ROUTINE_TEMPLATE_V1);
    edited.days[0]!.exercises[0]!.notes = 'Mi ajuste personal.';
    await db.routineTemplates.put(edited);
    expect(await upgradeRoutine()).toBe('preserved-custom');
    await ensureSeeded();
    expect(await db.routineTemplates.get(TEMPLATE_ID)).toEqual(edited);
    expect(await db.routineVersions.get(`${TEMPLATE_ID}@2`)).toBeUndefined();
  });

  it('conserva una versión histórica distinta en vez de sobrescribirla', async () => {
    await installLegacy();
    const saved = (await db.routineVersions.get(`${TEMPLATE_ID}@1`))!;
    saved.snapshot.name = 'Versión personal conservada';
    await db.routineVersions.put(saved);
    expect(await upgradeRoutine()).toBe('preserved-custom');
    expect((await db.routineVersions.get(saved.id))?.snapshot.name).toBe(saved.snapshot.name);
    expect((await db.routineTemplates.get(TEMPLATE_ID))?.version).toBe(1);
  });

  it('crea el snapshot antiguo si faltaba y admite reintentos concurrentes sin duplicar', async () => {
    await installLegacy(false);
    const states = await Promise.all([upgradeRoutine(), upgradeRoutine(), ensureSeeded()]);
    expect(states.slice(0, 2)).toContain('applied');
    expect(await db.routineVersions.count()).toBe(2);
    expect((await db.routineVersions.get(`${TEMPLATE_ID}@1`))?.snapshot).toEqual(ROUTINE_TEMPLATE_V1);
    expect(await upgradeRoutine()).toBe('current');
  });

  it('no ocupa un número de versión que ya contiene otra plantilla', async () => {
    await installLegacy();
    const collision = { ...structuredClone(ROUTINE_TEMPLATE), name: 'Mi versión dos' };
    await db.routineVersions.add({ id: `${TEMPLATE_ID}@2`, templateId: TEMPLATE_ID, version: 2, snapshot: collision, createdAt: collision.createdAt });
    expect(await upgradeRoutine()).toBe('preserved-custom');
    expect((await db.routineTemplates.get(TEMPLATE_ID))?.version).toBe(1);
    expect((await db.routineVersions.get(`${TEMPLATE_ID}@2`))?.snapshot).toEqual(collision);
  });

  it('un fallo revierte plantilla, snapshots y marcador de actualización', async () => {
    await installLegacy(false);
    const before = await exportBackup();
    const failure = vi.spyOn(db.routineTemplates, 'put').mockRejectedValueOnce(new Error('Escritura fallida'));
    await expect(upgradeRoutine()).rejects.toThrow('Escritura fallida');
    failure.mockRestore();
    expect((await exportBackup()).tables).toEqual(before.tables);
    expect(await db.meta.get(`routineUpgrade:${TEMPLATE_ID}@2`)).toBeUndefined();
    expect(await upgradeRoutine()).toBe('applied');
  });

  it('el respaldo exporta ambas versiones y restaura la rutina sin perder historial', async () => {
    await installLegacy();
    const { session, set } = await legacySession();
    await finishSession(session.id, 'partial');
    await upgradeRoutine();
    const backup = await exportBackup();
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.errors.join());
    expect(backup.tables.routineVersions?.map((version) => version.version).sort()).toEqual([1, 2]);
    await db.delete();
    await db.open();
    await applyImport(parsed.data, 'replace-all');
    expect((await exportBackup()).tables).toEqual(backup.tables);
    expect((await db.setLogs.get(set.id))?.load).toBe(40);
  });
});

describe('propiedad de plantillas importadas y reversión', () => {
  it('un respaldo previo permite volver a v1 y evita actualizarla otra vez', async () => {
    await installLegacy();
    await createProgram({ templateId: TEMPLATE_ID, startDate: '2026-10-12', timeZone: TZ });
    const oldBackup = await exportBackup();
    expect(await upgradeRoutine()).toBe('applied');
    await applyImport(oldBackup, 'replace-all');
    expect((await db.meta.get(IMPORTED_ROUTINES_KEY))?.value).toEqual([TEMPLATE_ID]);
    expect(await upgradeRoutine()).toBe('preserved-imported');
    await ensureSeeded();
    expect((await exportBackup()).tables).toEqual(oldBackup.tables);
  });

  it('marca solo plantillas efectivamente importadas al fusionar sin reemplazar', async () => {
    await installLegacy();
    const originalBackup = await exportBackup();
    await applyImport(originalBackup, 'merge-skip');
    expect((await db.meta.get(IMPORTED_ROUTINES_KEY))?.value).toEqual([]);
    const imported = structuredClone(ROUTINE_TEMPLATE_V1);
    imported.id = 'rutina-importada';
    await applyImport({ ...originalBackup, tables: { routineTemplates: [{ ...imported }] } }, 'merge-skip');
    expect((await db.meta.get(IMPORTED_ROUTINES_KEY))?.value).toEqual(['rutina-importada']);
    expect(await upgradeRoutine()).toBe('applied');
    expect(await db.routineTemplates.get(imported.id)).toEqual(imported);
  });

  it('una importación fallida conserva los marcadores anteriores', async () => {
    await installLegacy();
    const backup = await exportBackup();
    await db.meta.put({ key: IMPORTED_ROUTINES_KEY, value: ['mi-plantilla-anterior'] });
    backup.tables.variants = [];
    await expect(applyImport(backup, 'replace-all')).rejects.toThrow(/rutina.*variante/);
    expect((await db.meta.get(IMPORTED_ROUTINES_KEY))?.value).toEqual(['mi-plantilla-anterior']);
    expect((await db.routineTemplates.get(TEMPLATE_ID))?.version).toBe(1);
  });
});
