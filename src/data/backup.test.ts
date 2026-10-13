import { beforeEach, describe, expect, it } from 'vitest';
import { applyImport, exportBackup, exportCsv, parseBackup, previewImport } from './backup';
import { db } from './db';
import { createProgram, deleteScheduledWorkout, startScheduledWorkout } from './program';
import { ensureSeeded } from './seed';
import { confirmSet, discardSession, finishSession, liveSetsOf } from './sessions';

const TZ = 'America/Santiago';

async function withOneSession() {
  await db.delete();
  await db.open();
  await ensureSeeded();
  const program = await createProgram({ templateId: 'rt-atlas-4d', startDate: '2026-10-12', timeZone: TZ });
  const sws = await db.scheduledWorkouts.where('programId').equals(program.id).sortBy('date');
  const s = await startScheduledWorkout(sws[0]!.id, TZ);
  const se = (await db.sessionExercises.where('sessionId').equals(s.id).sortBy('order'))[0]!;
  const set = (await liveSetsOf(se.id))[0]!;
  await confirmSet(set.id, { load: 42.5, reps: 10, rir: 2 }, set.rev);
  await finishSession(s.id, 'partial');
  return { session: s, set };
}

beforeEach(async () => {
  await withOneSession();
});

describe('respaldo JSON', () => {
  it('exporta e importa sin duplicar (ida y vuelta)', async () => {
    const backup = await exportBackup();
    const text = JSON.stringify(backup);
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const preview = await previewImport(parsed.data);
    expect(preview.totals.added).toBe(0);
    expect(preview.totals.conflicts).toBe(0);
    const before = await db.setLogs.count();
    await applyImport(parsed.data, 'merge-skip');
    expect(await db.setLogs.count()).toBe(before);
  });

  it('restaura datos, unidades e identificadores en una base vacía', async () => {
    const backup = await exportBackup();
    const { set } = { set: (await db.setLogs.toArray()).find((s) => s.status === 'completed')! };
    await db.delete();
    await db.open();
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.errors.join());
    await applyImport(parsed.data, 'replace-all');
    const restored = await db.setLogs.get(set.id);
    expect(restored).toMatchObject({ load: 42.5, unit: 'kg', reps: 10, status: 'completed' });
  });

  it('un archivo inválido no modifica la base', async () => {
    const before = await db.setLogs.count();
    const backup = await exportBackup();
    (backup.tables.setLogs![0] as Record<string, unknown>).load = -5;
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.ok).toBe(false);
    expect(await db.setLogs.count()).toBe(before);
  });

  it('rechaza archivos que no son de ATLAS o de un esquema futuro', () => {
    expect(parseBackup('no json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'otra', schemaVersion: 1, exportedAt: new Date().toISOString(), tables: {} })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'atlas', schemaVersion: 99, exportedAt: new Date().toISOString(), tables: {} })).ok).toBe(false);
  });

  it('una transacción fallida no deja la base a medias', async () => {
    const backup = await exportBackup();
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error('parse');
    // Forzamos un fallo durante la escritura con un registro que rompe la clave primaria.
    const broken = structuredClone(parsed.data);
    broken.tables.cardioLogs = [{ id: undefined as unknown as string }];
    const before = await db.sessions.count();
    await expect(applyImport(broken, 'replace-all')).rejects.toBeTruthy();
    expect(await db.sessions.count()).toBe(before);
  });

  it('detecta conflictos por id', async () => {
    const backup = await exportBackup();
    (backup.tables.setLogs!.find((s) => s.status === 'completed') as Record<string, unknown>).reps = 11;
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error('parse');
    const p = await previewImport(parsed.data);
    expect(p.tables.setLogs?.conflicts).toBe(1);
  });

  it('rechaza zonas horarias que impedirían abrir la app', async () => {
    const backup = await exportBackup();
    backup.tables.profile![0]!.timeZone = 'zona-inexistente';
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(false);
  });

  it('rechaza plantillas sin la adaptación o el reparto de tiempo requerido por la interfaz', async () => {
    const backup = await exportBackup();
    delete backup.tables.routineTemplates![0]!.adaptation;
    expect(parseBackup(JSON.stringify(backup)).ok).toBe(false);
    const other = await exportBackup();
    const days = other.tables.routineTemplates![0]!.days as Record<string, unknown>[];
    delete days[0]!.timeSplit;
    expect(parseBackup(JSON.stringify(other)).ok).toBe(false);
  });

  it('reemplazar todo rechaza archivos parciales sin borrar los datos actuales', async () => {
    const backup = await exportBackup();
    delete backup.tables.profile;
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.errors.join());
    const before = await exportBackup();
    await expect(applyImport(parsed.data, 'replace-all')).rejects.toThrow(/incompleto/);
    expect((await exportBackup()).tables).toEqual(before.tables);
  });

  it('rechaza una serie cuya sesión y ejercicio no existen y revierte la importación', async () => {
    const backup = await exportBackup();
    const broken = structuredClone(backup.tables.setLogs![0]!);
    broken.id = 'serie-huerfana';
    broken.sessionId = 'sesion-inexistente';
    const partial = { ...backup, tables: { setLogs: [broken] } };
    const parsed = parseBackup(JSON.stringify(partial));
    if (!parsed.ok) throw new Error(parsed.errors.join());
    const before = await db.setLogs.count();
    await expect(applyImport(parsed.data, 'merge-skip')).rejects.toThrow(/serie.*sesión/i);
    expect(await db.setLogs.count()).toBe(before);
  });

  it('restaura su propio respaldo aunque se haya eliminado la planificación de una sesión descartada', async () => {
    const sw = (await db.scheduledWorkouts.filter((entry) => entry.sessionId === null).first())!;
    const session = await startScheduledWorkout(sw.id, TZ);
    await discardSession(session.id);
    await deleteScheduledWorkout(sw.id);
    const backup = await exportBackup();
    await expect(applyImport(backup, 'merge-skip')).resolves.toMatchObject({ written: 0 });
    await expect(applyImport(backup, 'replace-all')).resolves.toMatchObject({ written: expect.any(Number) });
    expect((await db.sessions.get(session.id))?.status).toBe('discarded');
  });

  it('rechaza reemplazar todo sin las variantes de la rutina y mantiene la base', async () => {
    const backup = await exportBackup();
    backup.tables.variants = [];
    const parsed = parseBackup(JSON.stringify(backup));
    if (!parsed.ok) throw new Error(parsed.errors.join());
    const before = await exportBackup();
    await expect(applyImport(parsed.data, 'replace-all')).rejects.toThrow(/rutina.*variante/i);
    expect((await exportBackup()).tables).toEqual(before.tables);
  });

  it('rechaza variantes sin su ejercicio y un programa activo sin días utilizables', async () => {
    const backup = await exportBackup();
    backup.tables.exercises = [];
    await expect(applyImport(backup, 'replace-all')).rejects.toThrow(/variante.*ejercicio/i);
    const emptyRoutine = await exportBackup();
    emptyRoutine.tables.routineTemplates![0]!.days = [];
    await expect(applyImport(emptyRoutine, 'replace-all')).rejects.toThrow(/programa.*días/i);
    expect((await db.routineTemplates.get('rt-atlas-4d'))?.days).toHaveLength(4);
  });

  it('no reemplaza datos mientras haya un entrenamiento en curso, aunque el archivo tenga revisiones antiguas', async () => {
    const sw = (await db.scheduledWorkouts.filter((entry) => entry.sessionId === null).first())!;
    const session = await startScheduledWorkout(sw.id, TZ);
    const se = (await db.sessionExercises.where('sessionId').equals(session.id).first())!;
    const set = (await liveSetsOf(se.id))[0]!;
    const backup = await exportBackup();
    const row = backup.tables.setLogs!.find((entry) => entry.id === set.id)!;
    row.load = 99;
    row.rev = 0;
    await expect(applyImport(backup, 'merge-replace')).rejects.toThrow(/entrenamiento en curso/);
    await expect(applyImport(backup, 'replace-all')).rejects.toThrow(/entrenamiento en curso/);
    expect((await db.setLogs.get(set.id))?.load).toBeNull();
    await expect(applyImport(backup, 'merge-skip')).resolves.toMatchObject({ written: 0 });
    expect((await db.setLogs.get(set.id))?.rev).toBe(set.rev);
  });

  it('no fusiona otro programa activo ni cambia el programa actual', async () => {
    const backup = await exportBackup();
    const current = (await db.programs.where('status').equals('active').first())!;
    const other = { ...current, id: 'programa-del-otro-dispositivo' };
    const incoming = { ...backup, tables: { programs: [other] } };
    const parsed = parseBackup(JSON.stringify(incoming));
    if (!parsed.ok) throw new Error(parsed.errors.join());
    for (const policy of ['merge-skip', 'merge-replace'] as const) {
      await expect(applyImport(parsed.data, policy)).rejects.toThrow(/dos programas activos.*reemplazar todo/i);
      expect(await db.programs.toArray()).toEqual([current]);
    }
  });
});

describe('CSV', () => {
  it('incluye unidad, carga normalizada y fechas con desfase', async () => {
    const { sets, sessions } = await exportCsv();
    expect(sets).toContain('carga_normalizada_kg');
    expect(sets).toContain('42.5,kg,42.5,10');
    expect(sessions).toMatch(/T\d{2}:\d{2}:\d{2}[-+]\d{2}:\d{2}/);
  });
});
