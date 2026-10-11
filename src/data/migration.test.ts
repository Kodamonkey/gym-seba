import { afterAll, describe, expect, it } from 'vitest';
import { AtlasDB, __setDbForTests, db as defaultDb } from './db';
import { createProgram, startScheduledWorkout } from './program';
import { ensureSeeded } from './seed';
import { confirmSet, getActiveSession, liveSetsOf } from './sessions';

/**
 * Simula una versión futura del esquema (v2) que añade un índice y transforma datos,
 * y verifica que una sesión activa y sus series sobreviven a la migración.
 */
class AtlasDBv2 extends AtlasDB {
  constructor(name: string) {
    super(name);
    this.version(2)
      .stores({ setLogs: 'id, sessionId, sessionExerciseId, status' })
      .upgrade((tx) =>
        tx
          .table('setLogs')
          .toCollection()
          .modify((s: Record<string, unknown>) => {
            s.migratedTo = 2;
          }),
      );
  }
}

afterAll(() => __setDbForTests(defaultDb));

describe('migraciones', () => {
  it('preservan la sesión activa y sus series', async () => {
    const name = 'atlas-migration-test';
    const v1 = new AtlasDB(name);
    await v1.delete();
    await v1.open();
    __setDbForTests(v1);
    await ensureSeeded();
    const program = await createProgram({ templateId: 'rt-atlas-4d', startDate: '2026-10-12', timeZone: 'America/Santiago' });
    const sw = (await v1.scheduledWorkouts.where('programId').equals(program.id).sortBy('date'))[0]!;
    const session = await startScheduledWorkout(sw.id, 'America/Santiago');
    const se = (await v1.sessionExercises.where('sessionId').equals(session.id).sortBy('order'))[0]!;
    const set = (await liveSetsOf(se.id))[0]!;
    await confirmSet(set.id, { load: 40, reps: 10 }, set.rev);
    v1.close();

    const v2 = new AtlasDBv2(name);
    await v2.open();
    __setDbForTests(v2);
    expect(v2.verno).toBe(2);
    const active = await getActiveSession();
    expect(active?.id).toBe(session.id);
    const migrated = (await v2.setLogs.get(set.id)) as unknown as Record<string, unknown>;
    expect(migrated).toMatchObject({ load: 40, reps: 10, status: 'completed', migratedTo: 2 });
    expect(await v2.setLogs.where('status').equals('completed').count()).toBe(1);
    v2.close();
  });
});
