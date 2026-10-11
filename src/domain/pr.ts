import type { ID, Instant, SetLog, WorkoutSession } from './types';

/**
 * Récords personales por contexto comparable. Son siempre derivados de los registros:
 * se reconstruyen con un recorrido cronológico y nunca se guardan como contadores.
 */

export type PRType = 'max-load' | 'reps-at-load' | 'set-volume' | 'session-volume' | 'max-duration';
export type PRStatus = 'first' | 'tie' | 'new';

export const PR_LABEL: Record<PRType, string> = {
  'max-load': 'Mayor carga registrada',
  'reps-at-load': 'Más repeticiones con esta carga',
  'set-volume': 'Mayor volumen en una serie',
  'session-volume': 'Mayor volumen en una sesión',
  'max-duration': 'Mayor duración',
};

export const PR_STATUS_LABEL: Record<PRStatus, string> = {
  first: 'Primer registro',
  tie: 'Igualas tu mejor marca',
  new: 'Nuevo récord',
};

export interface PREntry {
  setId: ID;
  sessionId: ID;
  key: string;
  /** Instante de confirmación (o del inicio de sesión si falta). */
  at: Instant;
  order: number;
  /** Carga normalizada en kg; null si no aplica. */
  loadKg: number | null;
  reps: number | null;
  durationSec: number | null;
  volumeKg: number | null;
}

export interface PREvent {
  type: PRType;
  status: PRStatus;
  key: string;
  setId: ID;
  sessionId: ID;
  at: Instant;
  value: number;
  previous: number | null;
  /** Para `reps-at-load`: la carga a la que se refiere. */
  loadKg?: number;
}

export interface PRBest {
  type: PRType;
  key: string;
  value: number;
  setId: ID;
  sessionId: ID;
  at: Instant;
  loadKg?: number;
}

export interface PRResult {
  events: PREvent[];
  /** Mejor marca vigente por clave y tipo (para reps-at-load, por carga). */
  bests: PRBest[];
}

/** Una serie solo cuenta si es de trabajo, está confirmada, no borrada y su sesión no fue descartada. */
export function isEligibleSet(set: SetLog, session: Pick<WorkoutSession, 'status'> | undefined): boolean {
  return (
    set.kind === 'work' &&
    set.status === 'completed' &&
    set.deletedAt === null &&
    !!session &&
    session.status !== 'discarded'
  );
}

const round = (n: number) => Math.round(n * 1000) / 1000;

function byTime(a: PREntry, b: PREntry): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  return a.order - b.order;
}

export function computePRs(entries: PREntry[]): PRResult {
  const sorted = [...entries].sort(byTime);
  const events: PREvent[] = [];
  const best = new Map<string, PRBest>();

  const consider = (
    type: PRType,
    e: PREntry,
    value: number,
    bucket: string,
    extra: Partial<PREvent> = {},
  ) => {
    const prev = best.get(bucket);
    let status: PRStatus | null;
    if (!prev) status = 'first';
    else if (value > prev.value) status = 'new';
    else if (value === prev.value) status = 'tie';
    else status = null;
    if (status === null) return;
    events.push({
      type,
      status,
      key: e.key,
      setId: e.setId,
      sessionId: e.sessionId,
      at: e.at,
      value,
      previous: prev?.value ?? null,
      ...extra,
    });
    if (status !== 'tie') {
      best.set(bucket, {
        type,
        key: e.key,
        value,
        setId: e.setId,
        sessionId: e.sessionId,
        at: e.at,
        ...(extra.loadKg !== undefined ? { loadKg: extra.loadKg } : {}),
      });
    }
  };

  // Volumen por sesión: se evalúa al cerrar cada sesión de la clave (último set de la sesión).
  const sessionTotals = new Map<string, { total: number; last: PREntry; hasVolume: boolean }>();
  for (const e of sorted) {
    const sk = `${e.key}::${e.sessionId}`;
    const cur = sessionTotals.get(sk) ?? { total: 0, last: e, hasVolume: false };
    if (e.volumeKg !== null) {
      cur.total = round(cur.total + e.volumeKg);
      cur.hasVolume = true;
    }
    cur.last = e;
    sessionTotals.set(sk, cur);
  }

  for (const e of sorted) {
    if (e.loadKg !== null && e.reps !== null) {
      consider('max-load', e, round(e.loadKg), `${e.key}::max-load`);
      const lk = round(e.loadKg);
      consider('reps-at-load', e, e.reps, `${e.key}::reps@${lk}`, { loadKg: lk });
    }
    if (e.volumeKg !== null) consider('set-volume', e, round(e.volumeKg), `${e.key}::set-volume`);
    if (e.durationSec !== null) consider('max-duration', e, e.durationSec, `${e.key}::max-duration`);

    const st = sessionTotals.get(`${e.key}::${e.sessionId}`);
    if (st && st.last.setId === e.setId && st.hasVolume) {
      consider('session-volume', e, st.total, `${e.key}::session-volume`);
    }
  }

  return { events, bests: [...best.values()] };
}

/** Eventos atribuibles a una serie concreta (para la insignia en vivo). */
export function eventsForSet(result: PRResult, setId: ID): PREvent[] {
  return result.events.filter((e) => e.setId === setId);
}

/**
 * Celebración en vivo: solo cuando al confirmar esta serie aparece un récord nuevo
 * que no existía antes de confirmarla. Nunca se dispara por importación o recálculo.
 */
export function newRecordsFromConfirm(before: PREntry[], confirmed: PREntry): PREvent[] {
  const after = computePRs([...before.filter((b) => b.setId !== confirmed.setId), confirmed]);
  return eventsForSet(after, confirmed.setId).filter((e) => e.status === 'new' && e.type !== 'session-volume');
}
