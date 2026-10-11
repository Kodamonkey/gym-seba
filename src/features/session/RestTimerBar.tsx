import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { formatClock } from '../../domain/dates';
import { ADJUST_STEP_MS, remainingMs } from '../../domain/timer';
import { db } from '../../data/db';
import { adjustRestTimer, clearRestTimer, finishRestTimer, pauseRestTimer, resumeRestTimer, skipRestTimer } from '../../data/timers';
import { useNow, usePrefs } from '../../app/hooks';

/**
 * Barra de descanso. El restante se recalcula desde el estado guardado en IndexedDB,
 * así que sobrevive a recargas, navegación y pestañas suspendidas. No promete avisos
 * con el teléfono bloqueado: sonido y vibración son mejoras opcionales.
 */
export function RestTimerBar({ sessionId, canEdit }: { sessionId: string; canEdit: boolean }) {
  const timer = useLiveQuery(() => db.restTimers.get('current'), []);
  const prefs = usePrefs();
  const running = !!timer && timer.sessionId === sessionId && (timer.status === 'running' || timer.status === 'paused');
  const now = useNow(250, running);
  const [announce, setAnnounce] = useState('');
  const notified = useRef<number | null>(null);

  const remaining = timer && timer.sessionId === sessionId ? remainingMs(timer, now) : 0;
  const finishedNow = running && timer!.status === 'running' && remaining === 0;

  useEffect(() => {
    if (!timer || !finishedNow || notified.current === timer.startedAt) return;
    notified.current = timer.startedAt;
    setAnnounce('Descanso terminado.');
    if (prefs?.restVibration && 'vibrate' in navigator) navigator.vibrate?.([180, 80, 180]);
    if (prefs?.restSound) beep();
    if (canEdit) void finishRestTimer();
  }, [finishedNow, timer, prefs, canEdit]);

  useEffect(() => {
    if (timer?.status === 'running' && timer.sessionId === sessionId) setAnnounce(`Descanso de ${formatClock(timer.durationMs)} iniciado.`);
  }, [timer?.startedAt, timer?.status, timer?.durationMs, timer?.sessionId, sessionId]);

  if (!timer || timer.sessionId !== sessionId) return <p className="sr-only" aria-live="polite">{announce}</p>;
  const done = timer.status === 'finished' || timer.status === 'skipped' || remaining === 0;
  const pct = timer.durationMs > 0 ? Math.min(100, (100 * (timer.durationMs - remaining)) / timer.durationMs) : 100;

  return (
    <div className="rest-timer fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 px-3" role="region" aria-label="Temporizador de descanso">
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <div className={`mx-auto flex max-w-3xl flex-col gap-2 rounded-2xl border px-3 py-2 shadow-lg ${done ? 'border-ok bg-surface' : 'border-line bg-surface-2'}`}>
        <div className="flex items-center gap-3">
          <div className="min-w-20">
            <p className="text-xs text-muted">{done ? 'Descanso terminado' : timer.status === 'paused' ? 'Descanso en pausa' : 'Descanso'}</p>
            <p className="text-3xl font-bold tabular" aria-hidden>
              {done ? '0:00' : formatClock(remaining)}
            </p>
          </div>
          <div className="flex flex-1 justify-end gap-1">
            {!done && (
              <>
                <button type="button" className="h-11 min-w-11 rounded-lg bg-surface-3 px-1.5 text-sm" disabled={!canEdit} onClick={() => adjustRestTimer(-ADJUST_STEP_MS)} aria-label="Restar 15 segundos">
                  −15 s
                </button>
                <button type="button" className="h-11 min-w-11 rounded-lg bg-surface-3 px-1.5 text-sm" disabled={!canEdit} onClick={() => adjustRestTimer(ADJUST_STEP_MS)} aria-label="Sumar 15 segundos">
                  +15 s
                </button>
                <button
                  type="button"
                  className="h-11 min-w-11 rounded-lg bg-surface-3 px-1.5 text-sm"
                  disabled={!canEdit}
                  onClick={() => (timer.status === 'paused' ? resumeRestTimer() : pauseRestTimer())}
                >
                  {timer.status === 'paused' ? 'Reanudar' : 'Pausar'}
                </button>
                <button type="button" className="h-11 min-w-11 rounded-lg bg-accent px-2 text-sm font-semibold text-accent-ink" disabled={!canEdit} onClick={() => skipRestTimer()}>
                  Omitir
                </button>
              </>
            )}
            {done && (
              <button type="button" className="h-11 rounded-lg bg-surface-3 px-3" disabled={!canEdit} onClick={() => clearRestTimer()}>
                Cerrar
              </button>
            )}
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
          <div className="h-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
        </div>
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
