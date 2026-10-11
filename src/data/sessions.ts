import { localDateOf } from '../domain/dates';
import { comparisonKeyOf, loadContextOf, normalizedLoadKg, setVolumeKg } from '../domain/load';
import type { PREntry } from '../domain/pr';
import { isEligibleSet } from '../domain/pr';
import type {
  ExerciseVariant,
  ID,
  Prescription,
  SessionExercise,
  SetKind,
  SetLog,
  Side,
  VariantSnapshot,
  WorkoutSession,
} from '../domain/types';
import { ConflictError, db, nowIso, uid } from './db';

/**
 * Operaciones de sesión. Cada escritura es una transacción; las series usan `rev`
 * para detectar ediciones concurrentes (otra pestaña) en lugar de sobrescribir en silencio.
 */

export class ActiveSessionExistsError extends Error {
  constructor(readonly sessionId: ID) {
    super('Ya hay una sesión en curso. Termínala o descártala antes de iniciar otra.');
    this.name = 'ActiveSessionExistsError';
  }
}

export function snapshotOf(v: ExerciseVariant): VariantSnapshot {
  return {
    name: v.name,
    exerciseId: v.exerciseId,
    equipmentKind: v.equipmentKind,
    config: { ...v.config },
    laterality: v.laterality,
    implements: v.implements,
    loadConvention: v.loadConvention,
    measure: v.measure,
    requiresEquipmentInstance: v.requiresEquipmentInstance,
  };
}

export interface PlannedExerciseInput {
  slotId: ID | null;
  variantId: ID;
  prescription: Prescription;
}

export interface StartSessionInput {
  programId: ID | null;
  scheduledWorkoutId: ID | null;
  dayId: ID | null;
  title: string;
  timeZone: string;
  programWeek: number | null;
  adaptation: boolean;
  exercises: PlannedExerciseInput[];
  now?: Date;
}

function draftSet(sessionId: ID, seId: ID, order: number, kind: SetKind, side: Side | null, now: string): SetLog {
  return {
    id: uid(),
    sessionId,
    sessionExerciseId: seId,
    order,
    kind,
    side,
    load: null,
    unit: 'kg',
    reps: null,
    durationSec: null,
    rir: null,
    status: 'draft',
    completedAt: null,
    rev: 1,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

async function lastEquipmentFor(variantId: ID): Promise<ID | null> {
  const rec = await db.meta.get(`lastEquipment:${variantId}`);
  return (rec?.value as ID | undefined) ?? null;
}

async function buildSessionExercise(
  sessionId: ID,
  order: number,
  input: PlannedExerciseInput,
  now: string,
): Promise<{ se: SessionExercise; sets: SetLog[] }> {
  const variant = await db.variants.get(input.variantId);
  if (!variant) throw new Error(`Variante no encontrada: ${input.variantId}`);
  const equipmentInstanceId = variant.requiresEquipmentInstance ? await lastEquipmentFor(variant.id) : null;
  const equipment = equipmentInstanceId ? await db.equipment.get(equipmentInstanceId) : undefined;
  const se: SessionExercise = {
    id: uid(),
    sessionId,
    order,
    slotId: input.slotId,
    variantId: variant.id,
    variant: snapshotOf(variant),
    equipmentInstanceId: equipment ? equipment.id : null,
    unit: equipment?.unit ?? 'kg',
    baseResistance: equipment?.declaredBaseResistance ?? null,
    prescribed: { ...input.prescription },
    substitutedFromVariantId: null,
    unilateralLogging: 'one-row-per-side-reps',
    restBetweenSides: false,
    techniqueConfirmed: null,
    painReported: false,
    notes: '',
    rev: 1,
    createdAt: now,
    updatedAt: now,
  };
  const sets = Array.from({ length: input.prescription.sets }, (_, i) => draftSet(sessionId, se.id, i + 1, 'work', null, now));
  return { se, sets };
}

export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  return db.sessions.where('status').equals('active').first();
}

export async function startSession(input: StartSessionInput): Promise<WorkoutSession> {
  const nowDate = input.now ?? new Date();
  const now = nowDate.toISOString();
  return db.transaction('rw', [db.sessions, db.sessionExercises, db.setLogs, db.scheduledWorkouts, db.variants, db.equipment, db.meta], async () => {
    const active = await db.sessions.where('status').equals('active').first();
    if (active) throw new ActiveSessionExistsError(active.id);
    if (input.scheduledWorkoutId) {
      const sw = await db.scheduledWorkouts.get(input.scheduledWorkoutId);
      if (!sw) throw new Error('La sesión planificada ya no existe.');
      if (sw.sessionId !== null) throw new Error('Esta sesión planificada ya tiene un registro. Ábrelo desde el calendario para corregirlo.');
    }

    const session: WorkoutSession = {
      id: uid(),
      programId: input.programId,
      scheduledWorkoutId: input.scheduledWorkoutId,
      dayId: input.dayId,
      title: input.title,
      localDate: localDateOf(nowDate, input.timeZone),
      timeZone: input.timeZone,
      startedAt: now,
      endedAt: null,
      status: 'active',
      pauses: [],
      programWeek: input.programWeek,
      adaptation: input.adaptation,
      notes: '',
      ownerTabId: null,
      rev: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.sessions.add(session);
    let order = 1;
    for (const ex of input.exercises) {
      const { se, sets } = await buildSessionExercise(session.id, order++, ex, now);
      await db.sessionExercises.add(se);
      await db.setLogs.bulkAdd(sets);
    }
    if (input.scheduledWorkoutId) {
      await db.scheduledWorkouts.update(input.scheduledWorkoutId, { sessionId: session.id, skippedConfirmed: false, updatedAt: now });
    }
    return session;
  });
}

/* ---------- Series ---------- */

export type SetPatch = Partial<Pick<SetLog, 'load' | 'reps' | 'durationSec' | 'rir' | 'kind' | 'side'>>;

async function mustGetSet(setId: ID): Promise<SetLog> {
  const set = await db.setLogs.get(setId);
  if (!set) throw new ConflictError('La serie ya no existe (quizá se borró en otra pestaña).');
  return set;
}

/** Guarda un borrador o corrige valores. Falla con ConflictError si `rev` cambió. */
export async function updateSet(setId: ID, patch: SetPatch, expectedRev: number): Promise<SetLog> {
  return db.transaction('rw', db.setLogs, async () => {
    const set = await mustGetSet(setId);
    if (set.rev !== expectedRev) throw new ConflictError();
    const next: SetLog = { ...set, ...patch, rev: set.rev + 1, updatedAt: nowIso() };
    await db.setLogs.put(next);
    return next;
  });
}

/**
 * Confirma una serie como realizada. Idempotente: un doble toque no duplica ni re-escribe.
 * La validación de valores se hace antes (checkSetForConfirm) con la misma regla que la UI.
 */
export async function confirmSet(setId: ID, values: SetPatch, expectedRev: number): Promise<SetLog> {
  return db.transaction('rw', [db.setLogs, db.sessionExercises, db.sessions], async () => {
    const set = await mustGetSet(setId);
    if (set.status === 'completed' && set.deletedAt === null) {
      // Doble toque con los mismos valores: no se duplica ni se re-escribe la fecha.
      const same = (Object.keys(values) as (keyof SetPatch)[]).every((k) => set[k] === values[k]);
      if (same) return set;
      throw new ConflictError('Esta serie ya estaba confirmada con otros valores (quizá en otra pestaña). Revisa y corrige si hace falta.');
    }
    if (set.rev !== expectedRev) throw new ConflictError();
    const se = await db.sessionExercises.get(set.sessionExerciseId);
    const session = await db.sessions.get(set.sessionId);
    if (!se || !session) throw new ConflictError('La sesión o el ejercicio ya no existen.');
    const now = nowIso();
    const next: SetLog = {
      ...set,
      ...values,
      unit: se.unit,
      status: 'completed',
      completedAt: now,
      rev: set.rev + 1,
      updatedAt: now,
    };
    await db.setLogs.put(next);
    return next;
  });
}

export async function uncompleteSet(setId: ID): Promise<SetLog> {
  return db.transaction('rw', db.setLogs, async () => {
    const set = await mustGetSet(setId);
    const next: SetLog = { ...set, status: 'draft', completedAt: null, rev: set.rev + 1, updatedAt: nowIso() };
    await db.setLogs.put(next);
    return next;
  });
}

export async function deleteSet(setId: ID): Promise<SetLog> {
  return db.transaction('rw', db.setLogs, async () => {
    const set = await mustGetSet(setId);
    const now = nowIso();
    const next: SetLog = { ...set, deletedAt: now, rev: set.rev + 1, updatedAt: now };
    await db.setLogs.put(next);
    return next;
  });
}

export async function restoreSet(setId: ID): Promise<SetLog> {
  return db.transaction('rw', db.setLogs, async () => {
    const set = await mustGetSet(setId);
    const next: SetLog = { ...set, deletedAt: null, rev: set.rev + 1, updatedAt: nowIso() };
    await db.setLogs.put(next);
    return next;
  });
}

export async function liveSetsOf(sessionExerciseId: ID): Promise<SetLog[]> {
  const sets = await db.setLogs.where('sessionExerciseId').equals(sessionExerciseId).toArray();
  return sets.filter((s) => s.deletedAt === null).sort((a, b) => a.order - b.order);
}

/** Añade una serie. Si `copyFrom`, copia valores pero NO el estado ni la fecha de ejecución. */
export async function addSet(sessionExerciseId: ID, kind: SetKind = 'work', copyFrom?: ID): Promise<SetLog> {
  return db.transaction('rw', [db.setLogs, db.sessionExercises], async () => {
    const se = await db.sessionExercises.get(sessionExerciseId);
    if (!se) throw new ConflictError('El ejercicio ya no existe.');
    const all = await db.setLogs.where('sessionExerciseId').equals(sessionExerciseId).toArray();
    const order = all.reduce((m, s) => Math.max(m, s.order), 0) + 1;
    const now = nowIso();
    const base = draftSet(se.sessionId, se.id, order, kind, null, now);
    if (copyFrom) {
      const src = await db.setLogs.get(copyFrom);
      if (src) {
        base.kind = src.kind;
        base.side = src.side;
        base.load = src.load;
        base.reps = src.reps;
        base.durationSec = src.durationSec;
        base.rir = src.rir;
      }
    }
    await db.setLogs.add(base);
    return base;
  });
}

export async function moveSet(setId: ID, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.setLogs, async () => {
    const set = await mustGetSet(setId);
    const siblings = (await db.setLogs.where('sessionExerciseId').equals(set.sessionExerciseId).toArray())
      .filter((s) => s.deletedAt === null)
      .sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((s) => s.id === setId);
    const other = siblings[idx + direction];
    if (!other) return;
    const now = nowIso();
    await db.setLogs.update(set.id, { order: other.order, rev: set.rev + 1, updatedAt: now });
    await db.setLogs.update(other.id, { order: set.order, rev: other.rev + 1, updatedAt: now });
  });
}

/* ---------- Ejercicios de la sesión ---------- */

export async function updateSessionExercise(
  seId: ID,
  patch: Partial<Pick<SessionExercise, 'techniqueConfirmed' | 'painReported' | 'notes' | 'restBetweenSides'>>,
): Promise<void> {
  await db.transaction('rw', db.sessionExercises, async () => {
    const se = await db.sessionExercises.get(seId);
    if (!se) throw new ConflictError('El ejercicio ya no existe.');
    await db.sessionExercises.put({ ...se, ...patch, rev: se.rev + 1, updatedAt: nowIso() });
  });
}

/** Identifica la máquina concreta. Copia su unidad y resistencia base (no cambian retroactivamente). */
export async function setEquipmentInstance(seId: ID, equipmentId: ID | null): Promise<void> {
  await db.transaction('rw', [db.sessionExercises, db.equipment, db.meta], async () => {
    const se = await db.sessionExercises.get(seId);
    if (!se) throw new ConflictError('El ejercicio ya no existe.');
    const eq = equipmentId ? await db.equipment.get(equipmentId) : undefined;
    await db.sessionExercises.put({
      ...se,
      equipmentInstanceId: eq?.id ?? null,
      unit: eq?.unit ?? 'kg',
      baseResistance: eq?.declaredBaseResistance ?? null,
      rev: se.rev + 1,
      updatedAt: nowIso(),
    });
    if (eq) await db.meta.put({ key: `lastEquipment:${se.variantId}`, value: eq.id });
  });
}

/** Cambia entre una fila con repeticiones por lado y filas separadas por lado. Solo sin series confirmadas. */
export async function setUnilateralLogging(seId: ID, mode: SessionExercise['unilateralLogging']): Promise<void> {
  await db.transaction('rw', [db.sessionExercises, db.setLogs], async () => {
    const se = await db.sessionExercises.get(seId);
    if (!se || se.unilateralLogging === mode) return;
    const sets = await db.setLogs.where('sessionExerciseId').equals(seId).toArray();
    if (sets.some((s) => s.status === 'completed' && s.deletedAt === null)) {
      throw new Error('Ya hay series confirmadas: no se puede cambiar la forma de registrar los lados.');
    }
    if (sets.some((s) => s.deletedAt === null && (s.load !== null || s.reps !== null || s.durationSec !== null || s.rir !== null))) {
      throw new Error('Hay valores escritos sin confirmar: confírmalos o bórralos antes de cambiar la forma de registrar los lados.');
    }
    const now = nowIso();
    await db.setLogs.bulkDelete(sets.map((s) => s.id));
    const count = se.prescribed.sets;
    const fresh: SetLog[] = [];
    let order = 1;
    for (let i = 0; i < count; i++) {
      if (mode === 'per-side-rows') {
        fresh.push(draftSet(se.sessionId, se.id, order++, 'work', 'left', now));
        fresh.push(draftSet(se.sessionId, se.id, order++, 'work', 'right', now));
      } else {
        fresh.push(draftSet(se.sessionId, se.id, order++, 'work', null, now));
      }
    }
    await db.setLogs.bulkAdd(fresh);
    await db.sessionExercises.put({ ...se, unilateralLogging: mode, rev: se.rev + 1, updatedAt: now });
  });
}

/**
 * Sustituye la variante. Sin series confirmadas: reemplaza y limpia borradores (no transfiere cargas).
 * Con series confirmadas: añade la alternativa como ejercicio nuevo con las series restantes.
 */
export async function substituteVariant(seId: ID, newVariantId: ID): Promise<ID> {
  return db.transaction('rw', [db.sessionExercises, db.setLogs, db.variants, db.equipment, db.meta], async () => {
    const se = await db.sessionExercises.get(seId);
    const v = await db.variants.get(newVariantId);
    if (!se || !v) throw new ConflictError('El ejercicio o la variante ya no existen.');
    const sets = (await db.setLogs.where('sessionExerciseId').equals(seId).toArray()).filter((s) => s.deletedAt === null);
    const completed = sets.filter((s) => s.status === 'completed');
    const now = nowIso();
    const equipmentInstanceId = v.requiresEquipmentInstance ? await lastEquipmentFor(v.id) : null;
    const eq = equipmentInstanceId ? await db.equipment.get(equipmentInstanceId) : undefined;

    if (completed.length === 0) {
      await db.sessionExercises.put({
        ...se,
        variantId: v.id,
        variant: snapshotOf(v),
        equipmentInstanceId: eq?.id ?? null,
        unit: eq?.unit ?? 'kg',
        baseResistance: eq?.declaredBaseResistance ?? null,
        substitutedFromVariantId: se.substitutedFromVariantId ?? se.variantId,
        unilateralLogging: 'one-row-per-side-reps',
        techniqueConfirmed: null,
        rev: se.rev + 1,
        updatedAt: now,
      });
      await db.setLogs.bulkDelete(sets.map((s) => s.id));
      await db.setLogs.bulkAdd(
        Array.from({ length: se.prescribed.sets }, (_, i) => draftSet(se.sessionId, se.id, i + 1, 'work', null, now)),
      );
      return se.id;
    }

    const siblings = await db.sessionExercises.where('sessionId').equals(se.sessionId).toArray();
    // Idempotencia: un segundo toque (u otra pestaña) no añade otra alternativa igual.
    const existing = siblings.find((s) => s.substitutedFromVariantId === se.variantId && s.variantId === v.id);
    if (existing) return existing.id;
    const rowsPerSet = se.variant.laterality === 'unilateral' && se.unilateralLogging === 'per-side-rows' ? 2 : 1;
    const doneSets = Math.floor(completed.filter((s) => s.kind === 'work').length / rowsPerSet);
    const remaining = Math.max(1, se.prescribed.sets - doneSets);
    for (const s of siblings) {
      if (s.order > se.order) await db.sessionExercises.update(s.id, { order: s.order + 1 });
    }
    const added: SessionExercise = {
      ...se,
      id: uid(),
      order: se.order + 1,
      variantId: v.id,
      variant: snapshotOf(v),
      equipmentInstanceId: eq?.id ?? null,
      unit: eq?.unit ?? 'kg',
      baseResistance: eq?.declaredBaseResistance ?? null,
      prescribed: { ...se.prescribed, sets: remaining },
      substitutedFromVariantId: se.variantId,
      unilateralLogging: 'one-row-per-side-reps',
      techniqueConfirmed: null,
      painReported: false,
      notes: '',
      rev: 1,
      createdAt: now,
      updatedAt: now,
    };
    await db.sessionExercises.add(added);
    // Borradores pendientes de la variante original se retiran (no se transfieren cargas).
    await db.setLogs.bulkDelete(sets.filter((s) => s.status === 'draft').map((s) => s.id));
    await db.setLogs.bulkAdd(Array.from({ length: remaining }, (_, i) => draftSet(se.sessionId, added.id, i + 1, 'work', null, now)));
    return added.id;
  });
}

export async function addExerciseToSession(sessionId: ID, variantId: ID, prescription: Prescription): Promise<ID> {
  return db.transaction('rw', [db.sessionExercises, db.setLogs, db.variants, db.equipment, db.meta], async () => {
    const existing = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
    const order = existing.reduce((m, s) => Math.max(m, s.order), 0) + 1;
    const { se, sets } = await buildSessionExercise(sessionId, order, { slotId: null, variantId, prescription }, nowIso());
    await db.sessionExercises.add(se);
    await db.setLogs.bulkAdd(sets);
    return se.id;
  });
}

/** Quita un ejercicio solo si no tiene series confirmadas. */
export async function removeExerciseFromSession(seId: ID): Promise<void> {
  await db.transaction('rw', [db.sessionExercises, db.setLogs], async () => {
    const sets = await db.setLogs.where('sessionExerciseId').equals(seId).toArray();
    if (sets.some((s) => s.status === 'completed' && s.deletedAt === null)) {
      throw new Error('Este ejercicio tiene series confirmadas: bórralas antes de quitarlo.');
    }
    await db.setLogs.bulkDelete(sets.map((s) => s.id));
    await db.sessionExercises.delete(seId);
  });
}

export async function moveSessionExercise(seId: ID, direction: -1 | 1): Promise<void> {
  await db.transaction('rw', db.sessionExercises, async () => {
    const se = await db.sessionExercises.get(seId);
    if (!se) return;
    const siblings = (await db.sessionExercises.where('sessionId').equals(se.sessionId).toArray()).sort((a, b) => a.order - b.order);
    const idx = siblings.findIndex((s) => s.id === seId);
    const other = siblings[idx + direction];
    if (!other) return;
    await db.sessionExercises.update(se.id, { order: other.order });
    await db.sessionExercises.update(other.id, { order: se.order });
  });
}

/* ---------- Ciclo de vida de la sesión ---------- */

async function mutateSession(sessionId: ID, fn: (s: WorkoutSession) => WorkoutSession): Promise<WorkoutSession> {
  return db.transaction('rw', [db.sessions, db.restTimers], async () => {
    const s = await db.sessions.get(sessionId);
    if (!s) throw new ConflictError('La sesión ya no existe.');
    const next = { ...fn(s), rev: s.rev + 1, updatedAt: nowIso() };
    await db.sessions.put(next);
    return next;
  });
}

export function pauseSession(sessionId: ID): Promise<WorkoutSession> {
  return mutateSession(sessionId, (s) => {
    const last = s.pauses[s.pauses.length - 1];
    if (last && last.end === null) return s;
    return { ...s, pauses: [...s.pauses, { start: nowIso(), end: null }] };
  });
}

export function resumeSession(sessionId: ID): Promise<WorkoutSession> {
  return mutateSession(sessionId, (s) => ({
    ...s,
    pauses: s.pauses.map((p, i) => (i === s.pauses.length - 1 && p.end === null ? { ...p, end: nowIso() } : p)),
  }));
}

/** Finaliza sin marcar como realizadas las series pendientes. */
export async function finishSession(sessionId: ID, status: 'completed' | 'partial'): Promise<WorkoutSession> {
  const s = await mutateSession(sessionId, (cur) => {
    const now = nowIso();
    return {
      ...cur,
      status,
      endedAt: now,
      pauses: cur.pauses.map((p) => (p.end === null ? { ...p, end: now } : p)),
    };
  });
  await db.restTimers.delete('current');
  return s;
}

export async function discardSession(sessionId: ID): Promise<WorkoutSession> {
  const s = await mutateSession(sessionId, (cur) => ({ ...cur, status: 'discarded', endedAt: cur.endedAt ?? nowIso() }));
  await db.transaction('rw', db.scheduledWorkouts, async () => {
    if (s.scheduledWorkoutId) await db.scheduledWorkouts.update(s.scheduledWorkoutId, { sessionId: null, updatedAt: nowIso() });
  });
  await db.restTimers.delete('current');
  return s;
}

export function updateSessionNotes(sessionId: ID, notes: string): Promise<WorkoutSession> {
  return mutateSession(sessionId, (s) => ({ ...s, notes }));
}

/** Corrección de una sesión histórica: reabre su estado (las series y PR se recalculan solos). */
export function setSessionStatus(sessionId: ID, status: 'completed' | 'partial'): Promise<WorkoutSession> {
  return mutateSession(sessionId, (s) => ({ ...s, status }));
}

/** ¿Están confirmadas todas las series de trabajo prescritas? */
export async function sessionCompleteness(sessionId: ID): Promise<{ done: number; expected: number; pendingDrafts: number }> {
  const ses = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
  const sets = (await db.setLogs.where('sessionId').equals(sessionId).toArray()).filter((s) => s.deletedAt === null);
  let expected = 0;
  let done = 0;
  for (const se of ses) {
    const perSide = se.unilateralLogging === 'per-side-rows' && se.variant.laterality === 'unilateral' ? 2 : 1;
    expected += se.prescribed.sets * perSide;
    done += Math.min(
      se.prescribed.sets * perSide,
      sets.filter((s) => s.sessionExerciseId === se.id && s.kind === 'work' && s.status === 'completed').length,
    );
  }
  const pendingDrafts = sets.filter((s) => s.status === 'draft').length;
  return { done, expected, pendingDrafts };
}

/* ---------- Historial comparable y PR ---------- */

export interface ComparableHistory {
  session: WorkoutSession;
  sessionExercise: SessionExercise;
  sets: SetLog[];
  confirmed: boolean;
}

/** Último registro de la misma clave de comparación (antes de la sesión actual). */
export async function previousComparable(se: SessionExercise): Promise<ComparableHistory | null> {
  const key = comparisonKeyOf(se);
  const current = await db.sessions.get(se.sessionId);
  const candidates = await db.sessionExercises.where('variantId').equals(se.variantId).toArray();
  let best: ComparableHistory | null = null;
  for (const c of candidates) {
    if (c.sessionId === se.sessionId) continue;
    if (comparisonKeyOf(c).key !== key.key) continue;
    const s = await db.sessions.get(c.sessionId);
    if (!s || (s.status !== 'completed' && s.status !== 'partial')) continue;
    if (current && s.startedAt >= current.startedAt) continue;
    if (best && best.session.startedAt >= s.startedAt) continue;
    const sets = (await db.setLogs.where('sessionExerciseId').equals(c.id).toArray())
      .filter((x) => x.status === 'completed' && x.deletedAt === null)
      .sort((a, b) => a.order - b.order);
    if (sets.length === 0) continue;
    best = { session: s, sessionExercise: c, sets, confirmed: key.confirmed };
  }
  return best;
}

/** Entradas para el cálculo de PR, opcionalmente filtradas por clave. */
export async function prEntries(filterKey?: string): Promise<PREntry[]> {
  const [sessions, ses, sets] = await Promise.all([db.sessions.toArray(), db.sessionExercises.toArray(), db.setLogs.toArray()]);
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const seById = new Map(ses.map((s) => [s.id, s]));
  const out: PREntry[] = [];
  for (const set of sets) {
    const session = sessionById.get(set.sessionId);
    const se = seById.get(set.sessionExerciseId);
    if (!se || !isEligibleSet(set, session)) continue;
    const key = comparisonKeyOf(se).key;
    if (filterKey && key !== filterKey) continue;
    const ctx = { ...loadContextOf(se), unit: set.unit };
    out.push({
      setId: set.id,
      sessionId: set.sessionId,
      key,
      // Orden cronológico por la sesión (una serie añadida tarde a una sesión pasada sigue siendo de esa fecha).
      at: session!.startedAt,
      date: session!.localDate,
      order: set.completedAt ? Date.parse(set.completedAt) : se.order * 1000 + set.order,
      loadKg: se.variant.measure === 'reps' ? normalizedLoadKg(set.load, ctx) : null,
      reps: se.variant.measure === 'reps' ? set.reps : null,
      durationSec: se.variant.measure === 'time' ? set.durationSec : null,
      volumeKg: setVolumeKg(set, ctx),
    });
  }
  return out;
}
