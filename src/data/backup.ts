import { z } from 'zod';
import { toCsv } from '../domain/csv';
import { formatInstantWithOffset, isLocalDate } from '../domain/dates';
import { loadContextOf, normalizedLoadKg, setVolumeKg } from '../domain/load';
import { sessionActiveMs, totalPausedMs } from '../domain/timer';
import { SCHEMA_VERSION } from '../domain/types';
import { LIMITS } from '../domain/validation';
import { db, nowIso, USER_TABLES, type UserTableName } from './db';

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
  localDate,
  timeZone: z.string().min(1),
  startedAt: instant,
  endedAt: nullableInstant,
  status: z.enum(['active', 'completed', 'partial', 'discarded']),
  pauses: z.array(z.looseObject({ start: instant, end: nullableInstant })),
  title: z.string(),
  rev: z.number().int().nonnegative(),
});

const sessionExerciseSchema = z.looseObject({
  id,
  sessionId: id,
  order: z.number().int(),
  variantId: id,
  variant: z.looseObject({ name: z.string(), loadConvention: z.string(), measure: z.enum(['reps', 'time']), laterality: z.enum(['bilateral', 'unilateral']) }),
  unit: z.enum(['kg', 'lb']),
  prescribed: z.looseObject({ sets: z.number().int().positive(), repMin: z.number().int(), repMax: z.number().int(), restSec: z.number().int().nonnegative() }),
});

const measurementSchema = z.looseObject({
  id,
  date: localDate,
  weightKg: z.number().positive().finite().nullable(),
  waistCm: z.number().positive().finite().nullable(),
});

const cardioSchema = z.looseObject({ id, date: localDate, durationMin: z.number().positive().finite(), distanceKm: z.number().nonnegative().finite().nullable() });
const scheduledSchema = z.looseObject({ id, programId: id, dayId: id, date: localDate, sessionId: id.nullable() });
const programSchema = z.looseObject({ id, templateId: id, startDate: localDate, weeks: z.number().int().positive(), adaptationWeeks: z.number().int().nonnegative() });
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
  timeZone: z.string().min(1),
  onboardedAt: nullableInstant,
});
const prefsSchema = z.looseObject({
  id: z.literal('prefs'),
  theme: z.enum(['dark', 'light', 'system']),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  animations: z.enum(['system', 'on', 'off']),
  backupReminderDays: z.number().int().nonnegative(),
});
const exerciseSchema = z.looseObject({ id, name: z.string().min(1), archived: z.boolean() });
const variantSchema = z.looseObject({
  id,
  exerciseId: id,
  name: z.string().min(1),
  equipmentKind: z.enum(['machine', 'cable', 'dumbbell', 'barbell', 'smith', 'bodyweight']),
  laterality: z.enum(['bilateral', 'unilateral']),
  implements: z.union([z.literal(1), z.literal(2)]),
  loadConvention: z.enum(['per-implement', 'total-external', 'plates-added', 'machine-stack', 'nominal', 'none']),
  measure: z.enum(['reps', 'time']),
  muscles: z.array(z.looseObject({ muscleId: z.string(), role: z.enum(['target', 'synergist', 'stabilizer']) })),
  technique: z.looseObject({ setup: z.string(), execution: z.string(), avoid: z.array(z.string()) }),
  clipId: z.string().nullable(),
});
const equipmentSchema = z.looseObject({
  id,
  name: z.string(),
  variantIds: z.array(z.string()),
  status: z.enum(['available', 'unavailable', 'unverified']),
  unit,
  minIncrement: z.number().finite().positive().nullable(),
  declaredBaseResistance: nonNegNullable,
});
const equipmentNoteSchema = z.looseObject({ id, equipmentId: id, text: z.string() });
const prescribedSchema = z.looseObject({
  id,
  variantId: id,
  sets: z.number().int().positive(),
  repMin: z.number().int().nonnegative(),
  repMax: z.number().int().nonnegative(),
  restSec: z.number().int().nonnegative(),
  alternativeVariantIds: z.array(z.string()),
});
const templateSchema = z.looseObject({
  id,
  name: z.string(),
  weeksTotal: z.number().int().positive(),
  version: z.number().int().positive(),
  days: z.array(z.looseObject({ id, name: z.string(), weekday: z.number().int().min(1).max(7), exercises: z.array(prescribedSchema) })),
});
const versionSchema = z.looseObject({ id, templateId: id, version: z.number().int().positive(), snapshot: templateSchema });
const programDecisionSchema = z.looseObject({ id, programId: id, kind: z.string(), createdAt: instant });
const progressionDecisionSchema = z.looseObject({
  id,
  comparisonKey: z.string(),
  decision: z.enum(['accepted', 'postponed', 'adjusted']),
  toLoad: nonNegNullable,
  unit,
});
const restTimerSchema = z.looseObject({
  id: z.literal('current'),
  sessionId: id,
  startedAt: z.number().finite(),
  durationMs: z.number().finite().nonnegative(),
  pausedTotalMs: z.number().finite().nonnegative(),
  status: z.enum(['running', 'paused', 'finished', 'skipped']),
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

/** Serialización canónica (claves ordenadas en todos los niveles) para comparar registros. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
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
  let written = 0;
  await db.transaction('rw', USER_TABLES.map((t) => db.table(t)), async () => {
    if (policy === 'replace-all') {
      for (const t of USER_TABLES) await db.table(t).clear();
    }
    for (const t of USER_TABLES) {
      const rows = data.tables[t] ?? [];
      if (rows.length === 0) continue;
      if (policy === 'merge-skip') {
        const existing = await db.table(t).bulkGet(rows.map((r) => r.id as string));
        const fresh = rows.filter((_, i) => !existing[i]);
        if (fresh.length) await db.table(t).bulkAdd(fresh);
        written += fresh.length;
      } else {
        await db.table(t).bulkPut(rows);
        written += rows.length;
      }
    }
    // Invariante: como máximo una sesión en curso. Si se rompe, la transacción se revierte entera.
    const active = await db.sessions.where('status').equals('active').count();
    if (active > 1) {
      throw new Error('La importación dejaría dos sesiones en curso. Finaliza o descarta la sesión actual antes de importar.');
    }
  });
  return { written };
}

/* ---------- CSV ---------- */

export async function exportCsv(): Promise<{ sessions: string; sets: string }> {
  const [sessions, ses, sets] = await Promise.all([db.sessions.toArray(), db.sessionExercises.toArray(), db.setLogs.toArray()]);
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
