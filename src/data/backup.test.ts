import { beforeEach, describe, expect, it } from 'vitest';
import { applyImport, exportBackup, exportCsv, parseBackup, previewImport } from './backup';
import { db } from './db';
import { createProgram, startScheduledWorkout } from './program';
import { ensureSeeded } from './seed';
import { confirmSet, finishSession, liveSetsOf } from './sessions';

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
});

describe('CSV', () => {
  it('incluye unidad, carga normalizada y fechas con desfase', async () => {
    const { sets, sessions } = await exportCsv();
    expect(sets).toContain('carga_normalizada_kg');
    expect(sets).toContain('42.5,kg,42.5,10');
    expect(sessions).toMatch(/T\d{2}:\d{2}:\d{2}[-+]\d{2}:\d{2}/);
  });
});
