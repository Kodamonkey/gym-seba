import Dexie, { type Table } from 'dexie';
import type { ExternalMedia } from '../domain/media';
import type {
  BodyMeasurement,
  CardioLog,
  EquipmentInstance,
  EquipmentNote,
  Exercise,
  ExerciseVariant,
  MetaRecord,
  Preferences,
  Program,
  ProgramDecision,
  ProgressionDecision,
  RestTimerState,
  RoutineTemplate,
  RoutineVersion,
  ScheduledWorkout,
  SessionExercise,
  SetLog,
  UserProfile,
  WorkoutSession,
} from '../domain/types';

/**
 * Base local (IndexedDB vía Dexie). El esquema es versionado: cada cambio de índices
 * o de forma de datos debe añadir un `this.version(n)` nuevo con su `upgrade`, sin
 * modificar las versiones anteriores, para preservar sesiones activas y el historial.
 */
export class AtlasDB extends Dexie {
  profile!: Table<UserProfile, string>;
  prefs!: Table<Preferences, string>;
  exercises!: Table<Exercise, string>;
  variants!: Table<ExerciseVariant, string>;
  equipment!: Table<EquipmentInstance, string>;
  equipmentNotes!: Table<EquipmentNote, string>;
  routineTemplates!: Table<RoutineTemplate, string>;
  routineVersions!: Table<RoutineVersion, string>;
  programs!: Table<Program, string>;
  scheduledWorkouts!: Table<ScheduledWorkout, string>;
  programDecisions!: Table<ProgramDecision, string>;
  sessions!: Table<WorkoutSession, string>;
  sessionExercises!: Table<SessionExercise, string>;
  setLogs!: Table<SetLog, string>;
  restTimers!: Table<RestTimerState, string>;
  bodyMeasurements!: Table<BodyMeasurement, string>;
  cardioLogs!: Table<CardioLog, string>;
  progressionDecisions!: Table<ProgressionDecision, string>;
  media!: Table<ExternalMedia, string>;
  meta!: Table<MetaRecord, string>;

  constructor(name = 'atlas') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      prefs: 'id',
      exercises: 'id',
      variants: 'id, exerciseId',
      equipment: 'id, *variantIds',
      equipmentNotes: 'id, equipmentId',
      routineTemplates: 'id',
      routineVersions: 'id, templateId',
      programs: 'id, status',
      scheduledWorkouts: 'id, programId, date, sessionId',
      programDecisions: 'id, programId',
      sessions: 'id, status, localDate, scheduledWorkoutId',
      sessionExercises: 'id, sessionId, variantId',
      setLogs: 'id, sessionId, sessionExerciseId',
      restTimers: 'id',
      bodyMeasurements: 'id, date',
      cardioLogs: 'id, date',
      progressionDecisions: 'id, comparisonKey',
      media: 'id, variantId',
      meta: 'key',
    });
  }
}

/** Tablas con datos del usuario (lo que se exporta e importa). */
export const USER_TABLES = [
  'profile',
  'prefs',
  'exercises',
  'variants',
  'equipment',
  'equipmentNotes',
  'routineTemplates',
  'routineVersions',
  'programs',
  'scheduledWorkouts',
  'programDecisions',
  'sessions',
  'sessionExercises',
  'setLogs',
  'restTimers',
  'bodyMeasurements',
  'cardioLogs',
  'progressionDecisions',
  'media',
] as const;

export type UserTableName = (typeof USER_TABLES)[number];

export let db = new AtlasDB();

/** Solo para pruebas: reemplaza la instancia por una base aislada. */
export function __setDbForTests(instance: AtlasDB): void {
  db = instance;
}

export function uid(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export class ConflictError extends Error {
  constructor(message = 'El registro cambió en otra pestaña o ventana.') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class StorageWriteError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'StorageWriteError';
  }
}

/** Traduce errores de IndexedDB a mensajes comprensibles. */
export function describeStorageError(err: unknown): string {
  if (err instanceof ConflictError) return err.message;
  const name = (err as { name?: string; inner?: { name?: string } })?.name ?? '';
  const inner = (err as { inner?: { name?: string } })?.inner?.name ?? '';
  if (name === 'QuotaExceededError' || inner === 'QuotaExceededError') {
    return 'No queda espacio de almacenamiento en el navegador. Tus datos siguen en pantalla: exporta un respaldo y libera espacio.';
  }
  if (name === 'DatabaseClosedError' || name === 'InvalidStateError') {
    return 'La base local se cerró (quizá por una actualización en otra pestaña). Recarga la página.';
  }
  return 'No se pudo guardar en el almacenamiento local. Tus datos siguen en pantalla; reintenta.';
}

/** Mensaje para el usuario: errores de negocio tal cual; errores de almacenamiento traducidos. */
export function userMessage(err: unknown): string {
  if (err instanceof Error && (err.name === 'Error' || err.name === 'ActiveSessionExistsError' || err.name === 'ConflictError')) return err.message;
  return describeStorageError(err);
}
