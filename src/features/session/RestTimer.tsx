import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../../domain/dates';
import { ADJUST_STEP_MS, remainingMs } from '../../domain/timer';
import { db } from '../../data/db';
import { adjustRestTimer, clearRestTimer, finishRestTimer, skipRestTimer } from '../../data/timers';
import { useNow, usePrefs } from '../../app/hooks';
import { TimerIcon } from '../../ui/icons';

/**
 * Descanso flotante. El restante se recalcula desde el estado guardado en IndexedDB, así que
 * sobrevive a recargas y pestañas suspendidas. Sonido y vibración son opcionales y no se
 * garantizan con el teléfono bloqueado.
 */
export function RestTimer({ sessionId, canEdit }: { sessionId: string; canEdit: boolean }) {
  const timer = useLiveQuery(() => db.restTimers.get('current'), []);
  const prefs = usePrefs();
  const mine = !!timer && timer.sessionId === sessionId;
  const running = mine && (timer.status === 'running' || timer.status === 'paused');
  const now = useNow(250, running);
  const [announce, setAnnounce] = useState('');
  const notified = useRef<number | null>(null);

  const remaining = mine ? remainingMs(timer, now) : 0;
  const finishedNow = running && timer.status === 'running' && remaining === 0;
  const done = mine && (timer.status === 'finished' || timer.status === 'skipped' || remaining === 0);

  useEffect(() => {
    if (!timer || !finishedNow || notified.current === timer.startedAt) return;
    notified.current = timer.startedAt;
    setAnnounce('Descanso terminado.');
    if (prefs?.restVibration && 'vibrate' in navigator) navigator.vibrate?.([180, 80, 180]);
    if (prefs?.restSound) beep();
    if (canEdit) void finishRestTimer();
  }, [finishedNow, timer, prefs, canEdit]);

  useEffect(() => {
    if (timer?.status === 'running' && timer.sessionId === sessionId) setAnnounce(`Descanso de ${formatClock(timer.durationMs)}.`);
  }, [timer?.startedAt, timer?.status, timer?.durationMs, timer?.sessionId, sessionId]);

  // Terminado: se retira solo a los pocos segundos.
  useEffect(() => {
    if (!done || !canEdit) return;
    const id = setTimeout(() => void clearRestTimer(), 4000);
    return () => clearTimeout(id);
  }, [done, canEdit, timer?.startedAt]);

  const live = (
    <p className="sr-only" aria-live="polite">
      {announce}
    </p>
  );
  if (!mine) return live;
  const pct = timer.durationMs > 0 ? Math.min(100, (100 * (timer.durationMs - remaining)) / timer.durationMs) : 100;
  const btn = 'inline-flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm font-medium active:bg-white/15 disabled:opacity-40';

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" role="region" aria-label="Descanso">
      {live}
      <div className={`anim-fade mx-auto max-w-xl overflow-hidden rounded-2xl shadow-2xl ${done ? 'bg-ok text-white' : 'bg-text text-bg'}`}>
        <div className="flex items-center gap-2 py-1.5 pl-4 pr-1.5">
          <TimerIcon className="flex-none opacity-70" />
          <span className="min-w-[4.25rem] text-[26px] font-bold tabular" aria-hidden>
            {done ? '0:00' : formatClock(remaining)}
          </span>
          <span className="flex-1 truncate text-[13px] opacity-90">{done ? '¡A la siguiente!' : ''}</span>
          {!done ? (
            <>
              <button type="button" className={btn} disabled={!canEdit} onClick={() => adjustRestTimer(-ADJUST_STEP_MS)} aria-label="Restar 15 segundos">
                −15
              </button>
              <button type="button" className={btn} disabled={!canEdit} onClick={() => adjustRestTimer(ADJUST_STEP_MS)} aria-label="Sumar 15 segundos">
                +15
              </button>
              <button type="button" className={`${btn} bg-white/15 font-semibold`} disabled={!canEdit} onClick={() => skipRestTimer()}>
                Saltar
              </button>
            </>
          ) : (
            <button type="button" className={btn} disabled={!canEdit} onClick={() => clearRestTimer()}>
              Cerrar
            </button>
          )}
        </div>
        {!done && (
          <div className="h-1 bg-white/15" aria-hidden>
            <div className="h-full bg-ok transition-[width] duration-200" style={{ width: `${pct}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => void ctx.close();
  } catch {
    // El navegador puede bloquear el audio sin interacción previa.
  }
}
