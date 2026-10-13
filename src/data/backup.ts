import { z } from 'zod';
import { toCsv } from '../domain/csv';
import { formatInstantWithOffset, isLocalDate } from '../domain/dates';
import { loadContextOf, normalizedLoadKg, setVolumeKg } from '../domain/load';
import { sessionActiveMs, totalPausedMs } from '../domain/timer';
import { SCHEMA_VERSION } from '../domain/types';
import { LIMITS } from '../domain/validation';
import { db, nowIso, USER_TABLES, type UserTableName } from './db';
import { IMPORTED_ROUTINES_KEY } from './routine-ownership';
import { canonical } from './canonical';

export { canonical } from './canonical';

/**
 * Respaldo e importación de datos propios. El archivo nunca incluye claves, tokens ni
 * medios de terceros: solo registros del usuario y metadatos de recursos.
 * Una importación inválida no modifica la base: todo ocurre en una sola transacción.
 */

export interface BackupFile {
  app: 'atlas';
  schemaVersion: number;
  exportedAt: string;
  tables: Partial<Record<UserTableName, Record<string, unknown>[]>>;
}

const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

export async function exportBackup(): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  await db.transaction('r', USER_TABLES.map((t) => db.table(t)), async () => {
    for (const t of USER_TABLES) tables[t] = (await db.table(t).toArray()) as Record<string, unknown>[];
  });
  return { app: 'atlas', schemaVersion: SCHEMA_VERSION, exportedAt: nowIso(), tables };
}

export async function markBackupDone(): Promise<void> {
  await db.meta.put({ key: 'lastBackupAt', value: nowIso() });
}

/* ---------- Validación (mismas reglas que la interfaz) ---------- */

const id = z.string().min(1).max(200);
const instant = z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'instante inválido');
const localDate = z.string().refine(isLocalDate, 'fecha local inválida');
const nullableInstant = instant.nullable();
const timestamps = { createdAt: instant, updatedAt: instant };
const timeZone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('es-CL', { timeZone: value }).format(0);
    return value.trim().length > 0;
  } catch {
    return false;
  }
}, 'zona horaria inválida');
const equipmentKind = z.enum(['machine', 'cable', 'dumbbell', 'barbell', 'smith', 'bodyweight']);
const loadConvention = z.enum(['per-implement', 'total-external', 'plates-added', 'machine-stack', 'nominal', 'none']);
const prescription = {
  sets: z.number().int().positive(),
  repMin: z.number().int().nonnegative(),
  repMax: z.number().int().nonnegative(),
  durationMin: z.number().int().positive().optional(),
  durationMax: z.number().int().positive().optional(),
  repsMode: z.enum(['total', 'per-side']),
  restSec: z.number().int().nonnegative(),
  rirMin: z.number().min(0).max(LIMITS.maxRir),
  rirMax: z.number().min(0).max(LIMITS.maxRir),
};
const variantSnapshot = {
  name: z.string(),
  exerciseId: id,
  equipmentKind,
  config: z.record(z.string(), z.string()),
  laterality: z.enum(['bilateral', 'unilateral']),
  implements: z.union([z.literal(1), z.literal(2)]),
  loadConvention,
  measure: z.enum(['reps', 'time']),
  requiresEquipmentInstance: z.boolean(),
};

const setLogSchema = z.looseObject({
  id,
  sessionId: id,
  sessionExerciseId: id,
  order: z.number().int(),
  kind: z.enum(['work', 'warmup']),
  side: z.enum(['left', 'right']).nullable(),
  load: z.number().finite().nonnegative().nullable(),
  unit: z.enum(['kg', 'lb']),
  reps: z.number().int().nonnegative().nullable(),
  durationSec: z.number().int().positive().nullable(),
  rir: z.number().min(0).max(LIMITS.maxRir).nullable(),
  status: z.enum(['draft', 'completed']),
  completedAt: nullableInstant,
  rev: z.number().int().nonnegative(),
  createdAt: instant,
  updatedAt: instant,
  deletedAt: nullableInstant,
});

const sessionSchema = z.looseObject({
  id,
  programId: id.nullable(),
  scheduledWorkoutId: id.nullable(),
  dayId: id.nullable(),
  localDate,
  timeZone,
  startedAt: instant,
  endedAt: nullableInstant,
  status: z.enum(['active', 'completed', 'partial', 'discarded']),
  pauses: z.array(z.looseObject({ start: instant, end: nullableInstant })),
  title: z.string(),
  programWeek: z.number().int().nullable(),
  adaptation: z.boolean(),
  notes: z.string(),
  ownerTabId: id.nullable(),
  rev: z.number().int().nonnegative(),
  ...timestamps,
});

const sessionExerciseSchema = z.looseObject({
  id,
  sessionId: id,
  order: z.number().int(),
  slotId: id.nullable(),
  variantId: id,
  variant: z.looseObject(variantSnapshot),
  equipmentInstanceId: id.nullable(),
  unit: z.enum(['kg', 'lb']),
  baseResistance: z.number().finite().nonnegative().nullable(),
  prescribed: z.looseObject(prescription),
  substitutedFromVariantId: id.nullable(),
  unilateralLogging: z.enum(['per-side-rows', 'one-row-per-side-reps']),
  restBetweenSides: z.boolean(),
  techniqueConfirmed: z.boolean().nullable(),
  painReported: z.boolean(),
  notes: z.string(),
  rev: z.number().int().nonnegative(),
  ...timestamps,
});

const measurementSchema = z.looseObject({
  id,
  date: localDate,
  weightKg: z.number().positive().finite().nullable(),
  waistCm: z.number().positive().finite().nullable(),
  notes: z.string(),
  ...timestamps,
});

const cardioSchema = z.looseObject({
  id, date: localDate, sessionId: id.nullable(), modality: z.string(), durationMin: z.number().positive().finite(),
  distanceKm: z.number().nonnegative().finite().nullable(), rpe: z.number().min(0).max(10).nullable(), notes: z.string(), ...timestamps,
});
const scheduledSchema = z.looseObject({
  id, programId: id, dayId: id, date: localDate, sessionId: id.nullable(), movedFrom: localDate.nullable(),
  origin: z.enum(['rule', 'manual']), skippedConfirmed: z.boolean(), ...timestamps,
});
const programSchema = z.looseObject({
  id, templateId: id, name: z.string(), startDate: localDate, weeks: z.number().int().positive(), adaptationWeeks: z.number().int().nonnegative(),
  timeZone, weekdays: z.record(z.string(), z.number().int().min(1).max(7)), status: z.enum(['active', 'archived']), ...timestamps,
});
const mediaSchema = z.looseObject({
  id,
  variantId: id,
  sourceUrl: z
    .string()
    .nullable()
    .refine((u) => u === null || /^https:\/\//.test(u), 'solo URLs https'),
  rightsReviewStatus: z.string(),
});
const unit = z.enum(['kg', 'lb']);
const nonNegNullable = z.number().finite().nonnegative().nullable();

const profileSchema = z.looseObject({
  id: z.literal('me'),
  name: z.string(),
  heightCm: nonNegNullable,
  weightKg: nonNegNullable,
  timeZone,
  onboardedAt: nullableInstant,
  experience: z.string(),
  capabilities: z.string(),
  goal: z.string(),
  gymName: z.string(),
  ...timestamps,
});
const prefsSchema = z.looseObject({
  id: z.literal('prefs'),
  appName: z.string(),
  theme: z.enum(['dark', 'light', 'system']),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  animations: z.enum(['system', 'on', 'off']),
  backupReminderDays: z.number().int().nonnegative(),
  autoplayDemos: z.boolean(),
  showStabilizers: z.boolean(),
  autoStartRest: z.boolean(),
  restSound: z.boolean(),
  restVibration: z.boolean(),
  keepAwake: z.boolean(),
  defaultRirMin: z.number().min(0).max(LIMITS.maxRir),
  defaultRirMax: z.number().min(0).max(LIMITS.maxRir),
  updatedAt: instant,
});
const exerciseSchema = z.looseObject({ id, name: z.string().min(1), archived: z.boolean(), ...timestamps });
const variantSchema = z.looseObject({
  id,
  ...variantSnapshot,
  name: z.string().min(1),
  loadNote: z.string().optional(),
  muscles: z.array(z.looseObject({ muscleId: z.string(), role: z.enum(['target', 'synergist', 'stabilizer']) })),
  musclesReviewStatus: z.enum(['unreviewed', 'reviewed']),
  technique: z.looseObject({
    setup: z.string(), execution: z.string(), avoid: z.array(z.string()),
    more: z.looseObject({ breathing: z.string().optional(), adjustments: z.string().optional(), details: z.string().optional() }),
    authoredBy: z.enum(['atlas', 'user']), reviewStatus: z.enum(['unreviewed', 'reviewed']),
  }),
  clipId: z.string().nullable(),
  archived: z.boolean(),
  custom: z.boolean(),
  ...timestamps,
});
const equipmentSchema = z.looseObject({
  id,
  name: z.string(),
  variantIds: z.array(z.string()),
  status: z.enum(['available', 'unavailable', 'unverified']),
  unit,
  minIncrement: z.number().finite().positive().nullable(),
  declaredBaseResistance: nonNegNullable,
  kind: equipmentKind,
  location: z.string(),
  archived: z.boolean(),
  ...timestamps,
});
const equipmentNoteSchema = z.looseObject({ id, equipmentId: id, text: z.string(), ...timestamps });
const prescribedSchema = z.looseObject({
  id,
  variantId: id,
  ...prescription,
  alternativeVariantIds: z.array(z.string()),
  notes: z.string(),
  noDirectAlternativeNote: z.string().optional(),
});
const templateSchema = z.looseObject({
  id,
  name: z.string(),
  weeksTotal: z.number().int().positive(),
  version: z.number().int().positive(),
  adaptation: z.looseObject({ weeks: z.number().int().nonnegative(), setsPerExercise: z.number().int().positive() }),
  days: z.array(z.looseObject({
    id, name: z.string(), weekday: z.number().int().min(1).max(7), exercises: z.array(prescribedSchema),
    timeSplit: z.looseObject({ warmupMin: z.number().finite().nonnegative(), strengthMin: z.number().finite().nonnegative(), cardioMin: z.number().finite().nonnegative(), cooldownMin: z.number().finite().nonnegative() }),
  })),
  archived: z.boolean(),
  ...timestamps,
});
const versionSchema = z.looseObject({ id, templateId: id, version: z.number().int().positive(), snapshot: templateSchema, createdAt: instant });
const programDecisionSchema = z.looseObject({ id, programId: id, kind: z.enum(['keep-adaptation', 'end-adaptation', 'reschedule', 'other']), detail: z.string(), createdAt: instant });
const progressionDecisionSchema = z.looseObject({
  id,
  comparisonKey: z.string(),
  variantId: id,
  sessionId: id,
  decision: z.enum(['accepted', 'postponed', 'adjusted']),
  fromLoad: nonNegNullable,
  toLoad: nonNegNullable,
  unit,
  createdAt: instant,
});
const restTimerSchema = z.looseObject({
  id: z.literal('current'),
  sessionId: id,
  setId: id.nullable(),
  startedAt: z.number().finite(),
  durationMs: z.number().finite().nonnegative(),
  pausedTotalMs: z.number().finite().nonnegative(),
  pausedAt: z.number().finite().nullable(),
  status: z.enum(['running', 'paused', 'finished', 'skipped']),
  updatedAt: z.number().finite(),
});

/** Un esquema por cada tabla exportable: nada se importa validado solo por `id`. */
const TABLE_SCHEMAS: Record<UserTableName, z.ZodType> = {
  profile: profileSchema,
  prefs: prefsSchema,
  exercises: exerciseSchema,
  variants: variantSchema,
  equipment: equipmentSchema,
  equipmentNotes: equipmentNoteSchema,
  routineTemplates: templateSchema,
  routineVersions: versionSchema,
  programs: programSchema,
  scheduledWorkouts: scheduledSchema,
  programDecisions: programDecisionSchema,
  sessions: sessionSchema,
  sessionExercises: sessionExerciseSchema,
  setLogs: setLogSchema,
  restTimers: restTimerSchema,
  bodyMeasurements: measurementSchema,
  cardioLogs: cardioSchema,
  progressionDecisions: progressionDecisionSchema,
  media: mediaSchema,
};

export type ParseResult = { ok: true; data: BackupFile } | { ok: false; errors: string[] };

export function parseBackup(text: string): ParseResult {
  if (text.length > MAX_IMPORT_BYTES) return { ok: false, errors: ['El archivo es demasiado grande (máx. 50 MB).'] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: ['El archivo no es JSON válido.'] };
  }
  const env = z
    .object({ app: z.literal('atlas'), schemaVersion: z.number().int().positive(), exportedAt: instant, tables: z.record(z.string(), z.array(z.unknown())) })
    .safeParse(raw);
  if (!env.success) return { ok: false, errors: ['No es un respaldo de ATLAS (faltan app, schemaVersion o tablas).'] };
  if (env.data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, errors: [`El respaldo usa el esquema ${env.data.schemaVersion}, más nuevo que esta app (${SCHEMA_VERSION}). Actualiza la app antes de importarlo.`] };
  }
  const errors: string[] = [];
  const tables: BackupFile['tables'] = {};
  for (const [name, rows] of Object.entries(env.data.tables)) {
    if (!(USER_TABLES as readonly string[]).includes(name)) {
      errors.push(`Tabla desconocida: ${name}.`);
      continue;
    }
    const schema = TABLE_SCHEMAS[name as UserTableName];
    const ids = new Set<string>();
    const ok: Record<string, unknown>[] = [];
    rows.forEach((row, i) => {
      const r = schema.safeParse(row);
      if (!r.success) {
        if (errors.length < 20) errors.push(`${name}[${i}]: ${r.error.issues.map((x) => `${x.path.join('.') || 'registro'} ${x.message}`).join('; ')}`);
        return;
      }
      const rec = r.data as Record<string, unknown>;
      const key = String(rec.id);
      if (ids.has(key)) {
        if (errors.length < 20) errors.push(`${name}: id duplicado dentro del archivo (${key}).`);
        return;
      }
      ids.add(key);
      ok.push(rec);
    });
    tables[name as UserTableName] = ok;
  }
  const activeInFile = (tables.sessions ?? []).filter((r) => r.status === 'active').length;
  if (activeInFile > 1) errors.push(`El respaldo contiene ${activeInFile} sesiones en curso; solo puede haber una.`);
  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { app: 'atlas', schemaVersion: env.data.schemaVersion, exportedAt: env.data.exportedAt, tables } };
}

/* ---------- Vista previa y aplicación ---------- */

export type ImportPolicy = 'merge-skip' | 'merge-replace' | 'replace-all';

export interface TablePreview {
  incoming: number;
  added: number;
  identical: number;
  conflicts: number;
  /** Registros locales que desaparecerán (solo con "reemplazar todo"). */
  removed: number;
}

export interface ImportPreview {
  tables: Partial<Record<UserTableName, TablePreview>>;
  activeSessionLocal: boolean;
  totals: TablePreview;
}

export async function previewImport(data: BackupFile, policy: ImportPolicy = 'merge-skip'): Promise<ImportPreview> {
  const out: ImportPreview['tables'] = {};
  const totals: TablePreview = { incoming: 0, added: 0, identical: 0, conflicts: 0, removed: 0 };
  for (const t of USER_TABLES) {
    const rows = data.tables[t] ?? [];
    const existing = await db.table(t).bulkGet(rows.map((r) => r.id as string));
    const p: TablePreview = { incoming: rows.length, added: 0, identical: 0, conflicts: 0, removed: 0 };
    rows.forEach((r, i) => {
      const cur = existing[i];
      if (!cur) p.added++;
      else if (canonical(cur) === canonical(r)) p.identical++;
      else p.conflicts++;
    });
    if (policy === 'replace-all') {
      const incomingIds = new Set(rows.map((r) => String(r.id)));
      const localIds = (await db.table(t).toCollection().primaryKeys()) as string[];
      p.removed = localIds.filter((k) => !incomingIds.has(String(k))).length;
    }
    out[t] = p;
    totals.incoming += p.incoming;
    totals.added += p.added;
    totals.identical += p.identical;
    totals.conflicts += p.conflicts;
    totals.removed += p.removed;
  }
  const activeSessionLocal = (await db.sessions.where('status').equals('active').count()) > 0;
  return { tables: out, activeSessionLocal, totals };
}

export async function applyImport(data: BackupFile, policy: ImportPolicy): Promise<{ written: number }> {
  // También protege a quienes llaman esta función fuera de la pantalla de importación.
  const parsed = parseBackup(JSON.stringify(data));
  if (!parsed.ok) throw new Error(`La importación no es válida: ${parsed.errors[0] ?? 'formato desconocido'}`);
  const incoming = parsed.data;
  if (policy === 'replace-all') {
    const missing = USER_TABLES.filter((t) => incoming.tables[t] === undefined);
    if (missing.length || !incoming.tables.profile?.length || !incoming.tables.prefs?.length || !incoming.tables.routineTemplates?.length) {
      throw new Error('La importación no se aplicó: el respaldo está incompleto. Para reemplazar todo, exporta un respaldo completo de ATLAS.');
    }
  }
  let written = 0;
  await db.transaction('rw', [...USER_TABLES.map((t) => db.table(t)), db.meta], async () => {
    if (policy !== 'merge-skip' && await db.sessions.where('status').equals('active').count() > 0) {
      throw new Error('La importación requiere terminar o descartar el entrenamiento en curso antes de reemplazar datos.');
    }
    if (policy === 'replace-all') {
      for (const t of USER_TABLES) await db.table(t).clear();
    }
    const previousImports = policy === 'replace-all' ? [] : (await db.meta.get(IMPORTED_ROUTINES_KEY))?.value;
    const importedRoutineIds = new Set<string>(Array.isArray(previousImports) ? previousImports.filter((value): value is string => typeof value === 'string') : []);
    for (const t of USER_TABLES) {
      const rows = incoming.tables[t] ?? [];
      if (rows.length === 0) continue;
      if (policy === 'merge-skip') {
        const existing = await db.table(t).bulkGet(rows.map((r) => r.id as string));
        const fresh = rows.filter((_, i) => !existing[i]);
        if (fresh.length) await db.table(t).bulkAdd(fresh);
        if (t === 'routineTemplates') fresh.forEach((row) => importedRoutineIds.add(String(row.id)));
        written += fresh.length;
      } else {
        await db.table(t).bulkPut(rows);
        if (t === 'routineTemplates') rows.forEach((row) => importedRoutineIds.add(String(row.id)));
        written += rows.length;
      }
    }
    // Invariante: como máximo una sesión en curso. Si se rompe, la transacción se revierte entera.
    const active = await db.sessions.where('status').equals('active').count();
    if (active > 1) {
      throw new Error('La importación dejaría dos sesiones en curso. Finaliza o descarta la sesión actual antes de importar.');
    }
    await validateImportedRelations(policy);
    await db.meta.put({ key: IMPORTED_ROUTINES_KEY, value: [...importedRoutineIds] });
  });
  return { written };
}

/** Comprueba los vínculos resultantes dentro de la misma transacción, antes de confirmarla. */
async function validateImportedRelations(policy: ImportPolicy): Promise<void> {
  const sessions = new Map((await db.sessions.toArray()).map((s) => [s.id, s]));
  const exercises = new Map((await db.sessionExercises.toArray()).map((se) => [se.id, se]));
  for (const se of exercises.values()) {
    if (!sessions.has(se.sessionId)) throw new Error('La importación contiene un ejercicio sin su sesión.');
  }
  for (const set of await db.setLogs.toArray()) {
    const se = exercises.get(set.sessionExerciseId);
    if (!sessions.has(set.sessionId) || !se || se.sessionId !== set.sessionId) {
      throw new Error('La importación contiene una serie sin su sesión o con un ejercicio de otra sesión.');
    }
  }
  const programs = new Map((await db.programs.toArray()).map((p) => [p.id, p]));
  const templates = new Map((await db.routineTemplates.toArray()).map((t) => [t.id, t]));
  const variants = new Map((await db.variants.toArray()).map((v) => [v.id, v]));
  const catalogExercises = new Set((await db.exercises.toCollection().primaryKeys()).map(String));
  for (const template of templates.values()) {
    for (const day of template.days) {
      for (const slot of day.exercises) {
        if ([slot.variantId, ...slot.alternativeVariantIds].some((variantId) => !variants.has(variantId))) {
          throw new Error('La importación contiene una rutina sin sus variantes de ejercicio.');
        }
      }
    }
  }
  for (const variant of variants.values()) {
    if (!catalogExercises.has(variant.exerciseId)) throw new Error('La importación contiene una variante sin su ejercicio del catálogo.');
  }
  const activePrograms = [...programs.values()].filter((p) => p.status === 'active');
  if (activePrograms.length > 1) {
    throw new Error('La importación dejaría dos programas activos. Para trasladar el programa de otro dispositivo, termina el entrenamiento en curso, exporta un respaldo actual y elige Reemplazar todo.');
  }
  if (policy === 'replace-all' && activePrograms.length !== 1) {
    throw new Error('La importación debe conservar un solo programa activo.');
  }
  for (const program of programs.values()) {
    const template = templates.get(program.templateId);
    if (!template) throw new Error('La importación contiene un programa sin su rutina.');
    if (program.status === 'active' && (template.archived || template.days.length === 0 || template.days.some((day) => day.exercises.length === 0 || program.weekdays[day.id] === undefined))) {
      throw new Error('La importación contiene un programa activo sin días de entrenamiento utilizables.');
    }
  }
  const scheduled = new Set((await db.scheduledWorkouts.toCollection().primaryKeys()).map(String));
  for (const s of sessions.values()) {
    // Descartar libera la planificación; luego se puede borrar sin perder la copia histórica.
    if ((s.programId && !programs.has(s.programId)) || (s.status !== 'discarded' && s.scheduledWorkoutId && !scheduled.has(s.scheduledWorkoutId))) {
      throw new Error('La importación contiene una sesión sin su programa o planificación.');
    }
  }
  for (const sw of await db.scheduledWorkouts.toArray()) {
    if (!programs.has(sw.programId) || (sw.sessionId && !sessions.has(sw.sessionId))) {
      throw new Error('La importación contiene una planificación sin su programa o sesión.');
    }
  }
}

/* ---------- CSV ---------- */

export async function exportCsv(): Promise<{ sessions: string; sets: string }> {
  const [sessions, ses, sets] = await db.transaction('r', [db.sessions, db.sessionExercises, db.setLogs], () =>
    Promise.all([db.sessions.toArray(), db.sessionExercises.toArray(), db.setLogs.toArray()]),
  );
  const now = Date.now();
  const sessionRows = sessions
    .sort((a, b) => (a.startedAt < b.startedAt ? -1 : 1))
    .map((s) => [
      s.id,
      s.localDate,
      formatInstantWithOffset(s.startedAt, s.timeZone),
      s.endedAt ? formatInstantWithOffset(s.endedAt, s.timeZone) : null,
      s.timeZone,
      s.status,
      s.title,
      s.programWeek,
      s.adaptation,
      Math.round(sessionActiveMs(s.startedAt, s.endedAt, s.pauses, now) / 6000) / 10,
      Math.round(totalPausedMs(s.pauses, s.endedAt ? Date.parse(s.endedAt) : now) / 6000) / 10,
      s.notes,
    ]);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const seById = new Map(ses.map((s) => [s.id, s]));
  const setRows = sets
    .filter((s) => s.deletedAt === null)
    .sort((a, b) => (a.sessionId === b.sessionId ? (seById.get(a.sessionExerciseId)?.order ?? 0) - (seById.get(b.sessionExerciseId)?.order ?? 0) || a.order - b.order : a.sessionId < b.sessionId ? -1 : 1))
    .map((s) => {
      const se = seById.get(s.sessionExerciseId);
      const session = sessionById.get(s.sessionId);
      const ctx = se ? { ...loadContextOf(se), unit: s.unit } : null;
      return [
        s.sessionId,
        session?.localDate ?? null,
        se?.order ?? null,
        se?.variant.name ?? null,
        se?.variantId ?? null,
        se?.equipmentInstanceId ?? null,
        se?.variant.loadConvention ?? null,
        se?.variant.implements ?? null,
        se?.variant.laterality ?? null,
        s.order,
        s.kind,
        s.side,
        s.load,
        s.unit,
        ctx ? normalizedLoadKg(s.load, ctx) : null,
        s.reps,
        se?.prescribed.repsMode ?? null,
        s.durationSec,
        s.rir,
        s.status,
        s.completedAt && session ? formatInstantWithOffset(s.completedAt, session.timeZone) : null,
        ctx && s.status === 'completed' && s.kind === 'work' ? setVolumeKg(s, ctx) : null,
      ];
    });
  return {
    sessions: toCsv(
      ['sesion_id', 'fecha_local', 'inicio', 'fin', 'zona_horaria', 'estado', 'titulo', 'semana_programa', 'adaptacion', 'tiempo_activo_min', 'pausas_min', 'notas'],
      sessionRows,
    ),
    sets: toCsv(
      [
        'sesion_id',
        'fecha_local',
        'orden_ejercicio',
        'variante',
        'variante_id',
        'equipo_id',
        'convencion_carga',
        'implementos',
        'lateralidad',
        'orden_serie',
        'tipo',
        'lado',
        'carga',
        'unidad',
        'carga_normalizada_kg',
        'repeticiones',
        'modo_repeticiones',
        'duracion_s',
        'rir',
        'estado',
        'confirmada_en',
        'volumen_registrado_kg_rep',
      ],
      setRows,
    ),
  };
}

export function downloadText(filename: string, text: string, type = 'application/json'): void {
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
