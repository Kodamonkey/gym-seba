import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_TZ, todayLocal } from '../domain/dates';
import type { Preferences, UserProfile } from '../domain/types';
import { db } from '../data/db';
import { getActiveSession } from '../data/sessions';

export function usePrefs(): Preferences | undefined {
  return useLiveQuery(() => db.prefs.get('prefs'), []);
}

export function useProfile(): UserProfile | undefined | null {
  return useLiveQuery(async () => (await db.profile.get('me')) ?? null, []);
}

export function useTimeZone(): string {
  const profile = useProfile();
  return profile?.timeZone ?? DEFAULT_TZ;
}

/** Fecha local de hoy; se actualiza al cruzar la medianoche o al volver a la pestaña. */
export function useToday(): string {
  const tz = useTimeZone();
  const [today, setToday] = useState(() => todayLocal(tz));
  useEffect(() => {
    const check = () => setToday(todayLocal(tz));
    check();
    const id = setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [tz]);
  return today;
}

/** Reloj para contadores visibles; el valor real siempre se recalcula desde datos guardados. */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    const onVis = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [intervalMs, enabled]);
  return now;
}

export function useActiveSession() {
  return useLiveQuery(async () => (await getActiveSession()) ?? null, []);
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function usePrefersReducedMotion(): boolean {
  const prefs = usePrefs();
  const [sys, setSys] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setSys(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  if (prefs?.animations === 'off') return true;
  if (prefs?.animations === 'on') return false;
  return sys;
}

/* ---------- Control de edición entre pestañas ---------- */

export const TAB_ID = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random());

export type LockState = 'pending' | 'owner' | 'viewer' | 'unsupported';

/**
 * Una sola pestaña edita la sesión activa (Web Locks). Las demás quedan en solo lectura
 * y pueden "tomar el control" explícitamente; si la pestaña editora se cierra, otra la
 * hereda automáticamente. Además, cada escritura comprueba `rev` (sin sobrescrituras silenciosas).
 */
export function useEditorLock(sessionId: string | null | undefined) {
  const [state, setState] = useState<LockState>('pending');
  const release = useRef<(() => void) | null>(null);
  const abort = useRef<AbortController | null>(null);

  const acquire = useCallback(
    (mode: 'try' | 'wait' | 'steal') => {
      if (!sessionId) return;
      const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
      if (!locks) {
        setState('unsupported');
        return;
      }
      abort.current?.abort();
      const ac = new AbortController();
      abort.current = ac;
      const name = `atlas-session-${sessionId}`;
      const opts: LockOptions = mode === 'try' ? { ifAvailable: true } : mode === 'steal' ? { steal: true } : { signal: ac.signal };
      locks
        .request(name, opts, async (lock) => {
          // Si el efecto ya se limpió (desmontaje, StrictMode), no retener el bloqueo.
          if (ac.signal.aborted) return;
          if (!lock) {
            setState('viewer');
            // Esperar a que la otra pestaña libere el control.
            queueMicrotask(() => acquire('wait'));
            return;
          }
          setState('owner');
          await new Promise<void>((res) => {
            release.current = res;
          });
        })
        .catch(() => {
          // Robado por otra pestaña o cancelado.
          setState((s) => (s === 'owner' ? 'viewer' : s));
          if (!ac.signal.aborted) queueMicrotask(() => acquire('wait'));
        });
    },
    [sessionId],
  );

  useEffect(() => {
    acquire('try');
    return () => {
      abort.current?.abort();
      release.current?.();
      release.current = null;
    };
  }, [acquire]);

  const takeControl = useCallback(() => acquire('steal'), [acquire]);
  return { state, canEdit: state === 'owner' || state === 'unsupported', takeControl };
}
