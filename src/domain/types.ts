/**
 * Tipos del dominio de ATLAS. Sin dependencias de UI ni de persistencia.
 *
 * Convenciones:
 * - `LocalDate` es una fecha civil `YYYY-MM-DD` (planificación). Nunca se convierte con `new Date(str)`.
 * - `Instant` es un instante ISO 8601 en UTC (`toISOString()`); se acompaña de `timeZone` cuando importa.
 * - Las cargas se guardan con su valor y unidad originales y su equivalente en kg.
 */

export type ID = string;
export type LocalDate = string;
export type Instant = string;

export const SCHEMA_VERSION = 1;

/* ---------- Catálogo ---------- */

export type MuscleRole = 'target' | 'synergist' | 'stabilizer';

export interface Muscle {
  id: ID;
  commonName: string;
  anatomicalName: string;
  /** Regiones del rig anatómico que representan este músculo. */
  regions: string[];
}

export interface VariantMuscleRole {
  muscleId: ID;
  role: MuscleRole;
}

/**
 * Convención de carga declarada por variante/equipo.
 * - per-implement: peso de cada mancuerna/implemento (se multiplica por `implements`).
 * - total-external: carga externa total (barra + discos).
 * - plates-added: discos añadidos (p. ej. Smith); la resistencia de la barra solo cuenta si está declarada.
 * - machine-stack: valor indicado en la pila de la máquina (nominal, no comparable entre máquinas).
 * - nominal: otra resistencia nominal identificada en `loadNote`.
 * - none: sin carga externa registrable.
 */
export type LoadConvention =
  | 'per-implement'
  | 'total-external'
  | 'plates-added'
  | 'machine-stack'
  | 'nominal'
  | 'none';

export type Laterality = 'bilateral' | 'unilateral';
export type MeasureKind = 'reps' | 'time';
export type LoadUnit = 'kg' | 'lb';

export type EquipmentKind =
  | 'machine'
  | 'cable'
  | 'dumbbell'
  | 'barbell'
  | 'smith'
  | 'bodyweight';

export interface TechniqueText {
  setup: string;
  execution: string;
  avoid: string[];
  more: { breathing?: string; adjustments?: string; details?: string };
  /** Quién redactó y en qué estado de revisión está el texto. */
  authoredBy: 'atlas' | 'user';
  reviewStatus: 'unreviewed' | 'reviewed';
}

export interface Exercise {
  id: ID;
  name: string;
  archived: boolean;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface ExerciseVariant {
  id: ID;
  exerciseId: ID;
  name: string;
  equipmentKind: EquipmentKind;
  /** Configuración relevante para la comparabilidad (agarre, inclinación, posición…). */
  config: Record<string, string>;
  laterality: Laterality;
  /** Número de implementos que se sostienen a la vez (2 mancuernas = 2). */
  implements: 1 | 2;
  loadConvention: LoadConvention;
  loadNote?: string;
  measure: MeasureKind;
  /** Si exige identificar la instancia de equipo para comparar cargas. */
  requiresEquipmentInstance: boolean;
  muscles: VariantMuscleRole[];
  musclesReviewStatus: 'unreviewed' | 'reviewed';
  technique: TechniqueText;
  /** Clip anatómico asociado (null = sin demostración disponible). */
  clipId: string | null;
  archived: boolean;
  custom: boolean;
  createdAt: Instant;
  updatedAt: Instant;
}

export type EquipmentStatus = 'available' | 'unavailable' | 'unverified';

export interface EquipmentInstance {
  id: ID;
  name: string;
  kind: EquipmentKind;
  /** Variantes para las que se ofrece esta instancia. */
  variantIds: ID[];
  status: EquipmentStatus;
  unit: LoadUnit;
  /** Menor incremento disponible en la unidad del equipo; null = desconocido. */
  minIncrement: number | null;
  /** Resistencia inicial declarada por el fabricante/gimnasio (solo si se conoce). */
  declaredBaseResistance: number | null;
  location: string;
  archived: boolean;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface EquipmentNote {
  id: ID;
  equipmentId: ID;
  text: string;
  createdAt: Instant;
  updatedAt: Instant;
}

/* ---------- Rutina ---------- */

export type RepsMode = 'total' | 'per-side';

export interface Prescription {
  sets: number;
  repMin: number;
  repMax: number;
  /** Para ejercicios por tiempo (segundos). */
  durationMin?: number;
  durationMax?: number;
  repsMode: RepsMode;
  restSec: number;
  rirMin: number;
  rirMax: number;
}

export interface PrescribedExercise extends Prescription {
  id: ID;
  variantId: ID;
  alternativeVariantIds: ID[];
  /** Mensaje cuando no hay una sustitución directa adecuada definida. */
  noDirectAlternativeNote?: string;
  notes: string;
}

export interface TimeSplit {
  warmupMin: number;
  strengthMin: number;
  cardioMin: number;
  cooldownMin: number;
}

export interface RoutineDay {
  id: ID;
  name: string;
  /** Día ISO sugerido (1 = lunes … 7 = domingo). */
  weekday: number;
  exercises: PrescribedExercise[];
  timeSplit: TimeSplit;
}

export interface RoutineTemplate {
  id: ID;
  name: string;
  weeksTotal: number;
  adaptation: { weeks: number; setsPerExercise: number };
  days: RoutineDay[];
  version: number;
  archived: boolean;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface RoutineVersion {
  id: ID;
  templateId: ID;
  version: number;
  snapshot: RoutineTemplate;
  createdAt: Instant;
}

/* ---------- Programa y calendario ---------- */

export interface Program {
  id: ID;
  templateId: ID;
  name: string;
  startDate: LocalDate;
  weeks: number;
  adaptationWeeks: number;
  timeZone: string;
  /** dayId → día ISO de la semana. */
  weekdays: Record<ID, number>;
  status: 'active' | 'archived';
  createdAt: Instant;
  updatedAt: Instant;
}

export interface ScheduledWorkout {
  id: ID;
  programId: ID;
  dayId: ID;
  date: LocalDate;
  /** Fecha original si se reprogramó. */
  movedFrom: LocalDate | null;
  origin: 'rule' | 'manual';
  skippedConfirmed: boolean;
  sessionId: ID | null;
  createdAt: Instant;
  updatedAt: Instant;
}

export type ProgramDecisionKind = 'keep-adaptation' | 'end-adaptation' | 'reschedule' | 'other';

export interface ProgramDecision {
  id: ID;
  programId: ID;
  kind: ProgramDecisionKind;
  detail: string;
  createdAt: Instant;
}

/* ---------- Ejecución ---------- */

export type SessionStatus = 'active' | 'completed' | 'partial' | 'discarded';

export interface Pause {
  start: Instant;
  end: Instant | null;
}

export interface WorkoutSession {
  id: ID;
  programId: ID | null;
  scheduledWorkoutId: ID | null;
  dayId: ID | null;
  title: string;
  localDate: LocalDate;
  timeZone: string;
  startedAt: Instant;
  endedAt: Instant | null;
  status: SessionStatus;
  pauses: Pause[];
  programWeek: number | null;
  adaptation: boolean;
  notes: string;
  /** Pestaña que tiene el control de edición. */
  ownerTabId: string | null;
  rev: number;
  createdAt: Instant;
  updatedAt: Instant;
}

/** Copia de los datos de la variante en el momento de la sesión. */
export interface VariantSnapshot {
  name: string;
  exerciseId: ID;
  equipmentKind: EquipmentKind;
  config: Record<string, string>;
  laterality: Laterality;
  implements: 1 | 2;
  loadConvention: LoadConvention;
  measure: MeasureKind;
  requiresEquipmentInstance: boolean;
}

export interface SessionExercise {
  id: ID;
  sessionId: ID;
  order: number;
  slotId: ID | null;
  variantId: ID;
  variant: VariantSnapshot;
  equipmentInstanceId: ID | null;
  /** Unidad y resistencia base del equipo copiadas al iniciar (no cambian retroactivamente). */
  unit: LoadUnit;
  baseResistance: number | null;
  prescribed: Prescription;
  substitutedFromVariantId: ID | null;
  /** Unilateral: una fila por lado o una fila con repeticiones por lado. */
  unilateralLogging: 'per-side-rows' | 'one-row-per-side-reps';
  restBetweenSides: boolean;
  techniqueConfirmed: boolean | null;
  painReported: boolean;
  notes: string;
  rev: number;
  createdAt: Instant;
  updatedAt: Instant;
}

export type SetKind = 'work' | 'warmup';
export type SetStatus = 'draft' | 'completed';
export type Side = 'left' | 'right';

export interface SetLog {
  id: ID;
  sessionId: ID;
  sessionExerciseId: ID;
  order: number;
  kind: SetKind;
  side: Side | null;
  /** Valor tal como se ingresó, en `unit`. null = no registrado (≠ 0). */
  load: number | null;
  unit: LoadUnit;
  reps: number | null;
  durationSec: number | null;
  rir: number | null;
  status: SetStatus;
  completedAt: Instant | null;
  rev: number;
  createdAt: Instant;
  updatedAt: Instant;
  deletedAt: Instant | null;
}

export interface RestTimerState {
  id: 'current';
  sessionId: ID;
  setId: ID | null;
  /** epoch ms */
  startedAt: number;
  durationMs: number;
  pausedAt: number | null;
  pausedTotalMs: number;
  status: 'running' | 'paused' | 'finished' | 'skipped';
  updatedAt: number;
}

/* ---------- Mediciones ---------- */

export interface BodyMeasurement {
  id: ID;
  date: LocalDate;
  weightKg: number | null;
  waistCm: number | null;
  notes: string;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface CardioLog {
  id: ID;
  date: LocalDate;
  sessionId: ID | null;
  modality: string;
  durationMin: number;
  distanceKm: number | null;
  rpe: number | null;
  notes: string;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface ProgressionDecision {
  id: ID;
  comparisonKey: string;
  variantId: ID;
  sessionId: ID;
  decision: 'accepted' | 'postponed' | 'adjusted';
  fromLoad: number | null;
  toLoad: number | null;
  unit: LoadUnit;
  createdAt: Instant;
}

/* ---------- Perfil y preferencias ---------- */

export interface UserProfile {
  id: 'me';
  name: string;
  heightCm: number | null;
  weightKg: number | null;
  experience: string;
  capabilities: string;
  goal: string;
  gymName: string;
  timeZone: string;
  onboardedAt: Instant | null;
  createdAt: Instant;
  updatedAt: Instant;
}

export interface Preferences {
  id: 'prefs';
  appName: string;
  theme: 'dark' | 'light' | 'system';
  accent: string;
  animations: 'system' | 'on' | 'off';
  autoplayDemos: boolean;
  showStabilizers: boolean;
  autoStartRest: boolean;
  restSound: boolean;
  restVibration: boolean;
  keepAwake: boolean;
  backupReminderDays: number;
  defaultRirMin: number;
  defaultRirMax: number;
  updatedAt: Instant;
}

export interface MetaRecord {
  key: string;
  value: unknown;
}
