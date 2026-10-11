import { adjustRest, finishRest, pauseRest, resumeRest, skipRest, startRest } from '../domain/timer';
import type { ID, RestTimerState } from '../domain/types';
import { db } from './db';

/** Persistencia del descanso: la única fuente de verdad es el registro guardado. */

export async function startRestTimer(sessionId: ID, setId: ID | null, durationSec: number): Promise<RestTimerState> {
  const t = startRest(sessionId, setId, durationSec * 1000, Date.now());
  await db.restTimers.put(t);
  return t;
}

async function mutate(fn: (t: RestTimerState, now: number) => RestTimerState): Promise<RestTimerState | undefined> {
  return db.transaction('rw', db.restTimers, async () => {
    const t = await db.restTimers.get('current');
    if (!t) return undefined;
    const next = fn(t, Date.now());
    await db.restTimers.put(next);
    return next;
  });
}

export const pauseRestTimer = () => mutate(pauseRest);
export const resumeRestTimer = () => mutate(resumeRest);
export const skipRestTimer = () => mutate(skipRest);
export const finishRestTimer = () => mutate(finishRest);
export const adjustRestTimer = (deltaMs: number) => mutate((t, now) => adjustRest(t, deltaMs, now));

export async function clearRestTimer(): Promise<void> {
  await db.restTimers.delete('current');
}
