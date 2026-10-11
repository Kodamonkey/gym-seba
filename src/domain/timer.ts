import type { ID, Pause, RestTimerState } from './types';

/**
 * Temporizador de descanso como estado persistido. El tiempo restante siempre se recalcula
 * desde los datos guardados; nunca depende de un contador en memoria.
 */

export const ADJUST_STEP_MS = 15_000;

export function startRest(sessionId: ID, setId: ID | null, durationMs: number, now: number): RestTimerState {
  return {
    id: 'current',
    sessionId,
    setId,
    startedAt: now,
    durationMs: Math.max(0, durationMs),
    pausedAt: null,
    pausedTotalMs: 0,
    status: 'running',
    updatedAt: now,
  };
}

/** Tiempo transcurrido efectivo. Acota retrocesos del reloj del dispositivo a cero. */
export function elapsedMs(t: RestTimerState, now: number): number {
  const reference = t.pausedAt ?? now;
  const raw = reference - t.startedAt - t.pausedTotalMs;
  return Math.max(0, raw);
}

export function remainingMs(t: RestTimerState, now: number): number {
  if (t.status === 'skipped' || t.status === 'finished') return 0;
  return Math.min(t.durationMs, Math.max(0, t.durationMs - elapsedMs(t, now)));
}

export function isFinished(t: RestTimerState, now: number): boolean {
  return t.status === 'finished' || t.status === 'skipped' || remainingMs(t, now) === 0;
}

export function pauseRest(t: RestTimerState, now: number): RestTimerState {
  if (t.status !== 'running') return t;
  return { ...t, pausedAt: Math.max(now, t.startedAt), status: 'paused', updatedAt: now };
}

export function resumeRest(t: RestTimerState, now: number): RestTimerState {
  if (t.status !== 'paused' || t.pausedAt === null) return t;
  const pausedFor = Math.max(0, now - t.pausedAt);
  return { ...t, pausedAt: null, pausedTotalMs: t.pausedTotalMs + pausedFor, status: 'running', updatedAt: now };
}

/** Ajusta ±15 s (u otro valor) sin producir un restante negativo. */
export function adjustRest(t: RestTimerState, deltaMs: number, now: number): RestTimerState {
  const elapsed = elapsedMs(t, now);
  const duration = Math.max(elapsed, t.durationMs + deltaMs);
  return { ...t, durationMs: duration, updatedAt: now };
}

export function skipRest(t: RestTimerState, now: number): RestTimerState {
  return { ...t, status: 'skipped', updatedAt: now };
}

export function finishRest(t: RestTimerState, now: number): RestTimerState {
  return { ...t, status: 'finished', updatedAt: now };
}

/* ---------- Duración de la sesión ---------- */

export function totalPausedMs(pauses: Pause[], now: number): number {
  return pauses.reduce((acc, p) => {
    const start = Date.parse(p.start);
    const end = p.end ? Date.parse(p.end) : now;
    return acc + Math.max(0, end - start);
  }, 0);
}

/** Tiempo activo de sesión = (fin o ahora) − inicio − pausas. Nunca negativo. */
export function sessionActiveMs(startedAt: string, endedAt: string | null, pauses: Pause[], now: number): number {
  const end = endedAt ? Date.parse(endedAt) : now;
  const effectiveNow = Math.min(end, now);
  return Math.max(0, effectiveNow - Date.parse(startedAt) - totalPausedMs(pauses, effectiveNow));
}

export function isSessionPaused(pauses: Pause[]): boolean {
  const last = pauses[pauses.length - 1];
  return !!last && last.end === null;
}
