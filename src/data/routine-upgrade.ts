import type { RoutineTemplate } from '../domain/types';
import { canonical } from './canonical';
import { db, nowIso } from './db';
import { IMPORTED_ROUTINES_KEY } from './routine-ownership';
import { ROUTINE_TEMPLATE } from './seed/routine';
import { ROUTINE_TEMPLATE_V1 } from './seed/routine-v1';

export type RoutineUpgradeState = 'current' | 'unavailable' | 'applied' | 'deferred-active' | 'preserved-custom' | 'preserved-imported';

/**
 * Actualiza únicamente la plantilla original intacta. Las sesiones conservan sus copias;
 * una sesión activa difiere el cambio para mantener sus alternativas y su vista del día.
 * El calendario, los programas y las decisiones de adaptación no se modifican.
 */
export async function upgradeRoutine(): Promise<RoutineUpgradeState> {
  return db.transaction('rw', [db.meta, db.routineTemplates, db.routineVersions, db.sessions], async () => {
    const current = await db.routineTemplates.get(ROUTINE_TEMPLATE.id);
    if (!current) return 'unavailable';
    if (current.version >= ROUTINE_TEMPLATE.version) return 'current';

    const statusKey = `routineUpgrade:${ROUTINE_TEMPLATE.id}@${ROUTINE_TEMPLATE.version}`;
    async function record(state: Exclude<RoutineUpgradeState, 'current' | 'unavailable'>): Promise<typeof state> {
      const previous = (await db.meta.get(statusKey))?.value as { state?: string } | undefined;
      if (previous?.state !== state) {
        await db.meta.put({
          key: statusKey,
          value: { state, fromVersion: current!.version, toVersion: ROUTINE_TEMPLATE.version, updatedAt: nowIso() },
        });
      }
      return state;
    }

    const imported = (await db.meta.get(IMPORTED_ROUTINES_KEY))?.value;
    if (Array.isArray(imported) && imported.includes(current.id)) return record('preserved-imported');
    if (canonical(current) !== canonical(ROUTINE_TEMPLATE_V1)) return record('preserved-custom');
    if (await db.sessions.where('status').equals('active').count() > 0) return record('deferred-active');

    // Los IDs existentes mantienen todas las fechas y vínculos del programa.
    if (canonical(current.days.map((day) => day.id)) !== canonical(ROUTINE_TEMPLATE.days.map((day) => day.id))) {
      throw new Error('La actualización de rutina debe conservar los días del programa.');
    }
    const oldVersionId = `${current.id}@${current.version}`;
    const nextVersionId = `${current.id}@${ROUTINE_TEMPLATE.version}`;
    const oldVersion = await db.routineVersions.get(oldVersionId);
    const nextVersion = await db.routineVersions.get(nextVersionId);
    const next: RoutineTemplate = { ...structuredClone(ROUTINE_TEMPLATE), createdAt: current.createdAt, updatedAt: nowIso() };
    if ((oldVersion && (oldVersion.templateId !== current.id || oldVersion.version !== current.version || canonical(oldVersion.snapshot) !== canonical(current))) ||
        (nextVersion && (nextVersion.templateId !== next.id || nextVersion.version !== next.version ||
          canonical({ ...nextVersion.snapshot, updatedAt: next.updatedAt }) !== canonical(next)))) {
      return record('preserved-custom');
    }
    if (!oldVersion) {
      await db.routineVersions.add({ id: oldVersionId, templateId: current.id, version: current.version, snapshot: structuredClone(current), createdAt: nowIso() });
    }
    if (!nextVersion) {
      await db.routineVersions.add({ id: nextVersionId, templateId: next.id, version: next.version, snapshot: structuredClone(next), createdAt: nowIso() });
    }
    await db.routineTemplates.put(next);
    return record('applied');
  });
}
