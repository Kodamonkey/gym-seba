import { DEFAULT_TZ } from '../domain/dates';
import type { Preferences, UserProfile } from '../domain/types';
import { db, nowIso } from './db';
import { EXERCISES, VARIANTS } from './seed/catalog';
import { EQUIPMENT } from './seed/equipment';
import { ROUTINE_TEMPLATE } from './seed/routine';

/**
 * Siembra del catálogo y la rutina inicial. No crea historial, sesiones, PR ni mediciones.
 * Es idempotente: solo añade elementos que faltan y nunca sobrescribe ediciones del usuario.
 */

export const SEED_VERSION = 1;

export function defaultProfile(): UserProfile {
  const now = nowIso();
  return {
    id: 'me',
    name: 'Seba',
    heightCm: 172,
    weightKg: 82,
    experience: 'Principiante',
    capabilities: 'Puedo correr y hacer flexiones',
    goal: 'Salud, condición física y un físico fuerte, delgado y atlético',
    gymName: 'Smart Fit Mallplaza Vespucio, Chile',
    timeZone: DEFAULT_TZ,
    onboardedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function defaultPreferences(): Preferences {
  return {
    id: 'prefs',
    appName: 'ATLAS — Mi entrenamiento',
    theme: 'dark',
    accent: '#3ddc97',
    animations: 'system',
    autoplayDemos: false,
    showStabilizers: false,
    autoStartRest: true,
    restSound: false,
    restVibration: false,
    keepAwake: false,
    backupReminderDays: 7,
    defaultRirMin: 2,
    defaultRirMax: 3,
    updatedAt: nowIso(),
  };
}

export async function ensureSeeded(): Promise<void> {
  await db.transaction(
    'rw',
    [db.meta, db.profile, db.prefs, db.exercises, db.variants, db.equipment, db.routineTemplates, db.routineVersions],
    async () => {
      const current = (await db.meta.get('seedVersion'))?.value as number | undefined;
      if (current !== undefined && current >= SEED_VERSION) return;

      if (!(await db.profile.get('me'))) await db.profile.add(defaultProfile());
      if (!(await db.prefs.get('prefs'))) await db.prefs.add(defaultPreferences());

      const addMissing = async <T extends { id: string }>(table: typeof db.exercises | typeof db.variants | typeof db.equipment, rows: T[]) => {
        const existing = new Set((await table.toCollection().primaryKeys()) as string[]);
        const missing = rows.filter((r) => !existing.has(r.id));
        if (missing.length) await (table as unknown as { bulkAdd(rows: T[]): Promise<unknown> }).bulkAdd(missing);
      };
      await addMissing(db.exercises, EXERCISES);
      await addMissing(db.variants, VARIANTS);
      await addMissing(db.equipment, EQUIPMENT);

      if (!(await db.routineTemplates.get(ROUTINE_TEMPLATE.id))) {
        await db.routineTemplates.add(ROUTINE_TEMPLATE);
        await db.routineVersions.add({
          id: `${ROUTINE_TEMPLATE.id}@1`,
          templateId: ROUTINE_TEMPLATE.id,
          version: 1,
          snapshot: ROUTINE_TEMPLATE,
          createdAt: nowIso(),
        });
      }
      await db.meta.put({ key: 'seedVersion', value: SEED_VERSION });
    },
  );
}
