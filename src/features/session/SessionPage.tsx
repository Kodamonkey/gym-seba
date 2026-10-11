import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useActiveSession, useEditorLock, useNow, usePrefs } from '../../app/hooks';
import { formatDuration } from '../../domain/dates';
import { isSessionPaused, sessionActiveMs } from '../../domain/timer';
import type { SessionExercise, SetLog } from '../../domain/types';
import { db, describeStorageError } from '../../data/db';
import { pauseSession, resumeSession } from '../../data/sessions';
import { Button, EmptyState, Loading, Pill } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { ExercisePanel } from './ExercisePanel';
import { FinishDialog } from './FinishDialog';
import { RestTimerBar } from './RestTimerBar';
import { AddExerciseDialog } from './AddExerciseDialog';

/** Modo entrenamiento: una sesión activa recuperable tras recargar o suspender la pestaña. */
export function SessionPage() {
  const session = useActiveSession();
  const navigate = useNavigate();
  const toast = useToast();
  const prefs = usePrefs();
  const lock = useEditorLock(session?.id);
  const now = useNow(1000, !!session);
  const [finishOpen, setFinishOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const data = useLiveQuery(async () => {
    if (!session) return null;
    const ses = await db.sessionExercises.where('sessionId').equals(session.id).sortBy('order');
    const sets = await db.setLogs.where('sessionId').equals(session.id).toArray();
    return { ses, sets };
  }, [session?.id]);

  const storageKey = session ? `atlas:current-exercise:${session.id}` : '';
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (!data || !session) return;
    if (current && data.ses.some((s) => s.id === current)) return;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(storageKey);
    } catch {
      saved = null;
    }
    const fallback = data.ses.find((se) => pendingCount(se, data.sets) > 0)?.id ?? data.ses[0]?.id ?? null;
    setCurrent(saved && data.ses.some((s) => s.id === saved) ? saved : fallback);
  }, [data, session, current, storageKey]);

  useEffect(() => {
    if (!current || !storageKey) return;
    try {
      sessionStorage.setItem(storageKey, current);
    } catch {
      // Almacenamiento de sesión no disponible: solo se pierde el ejercicio seleccionado.
    }
  }, [current, storageKey]);

  // Mantener la pantalla encendida (opcional y solo si el navegador lo permite).
  useEffect(() => {
    if (!prefs?.keepAwake || !session || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((s) => (sentinel = s))
        .catch(() => undefined);
    void request();
    const onVis = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      void sentinel?.release();
    };
  }, [prefs?.keepAwake, session]);

  const byExercise = useMemo(() => {
    const m = new Map<string, SetLog[]>();
    for (const s of data?.sets ?? []) m.set(s.sessionExerciseId, [...(m.get(s.sessionExerciseId) ?? []), s]);
    return m;
  }, [data?.sets]);

  if (session === undefined || (session && !data)) return <Loading label="Recuperando la sesión…" />;
  if (!session) {
    return (
      <EmptyState title="No hay una sesión en curso" action={<Link to="/" className="text-accent underline">Ir a Hoy</Link>}>
        Inicia el entrenamiento del día desde la pantalla Hoy.
      </EmptyState>
    );
  }

  const paused = isSessionPaused(session.pauses);
  const elapsed = sessionActiveMs(session.startedAt, session.endedAt, session.pauses, now);
  const ses = data!.ses;
  const cur = ses.find((s) => s.id === current) ?? ses[0];
  const idx = cur ? ses.indexOf(cur) : -1;

  return (
    <div className="flex flex-col gap-3 pb-40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{session.title}</h1>
          <p className="text-sm text-muted tabular">
            {paused ? 'Sesión en pausa' : 'Tiempo activo'}: {formatDuration(elapsed)}
            {session.adaptation && ' · adaptación'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            disabled={!lock.canEdit}
            onClick={() => (paused ? resumeSession(session.id) : pauseSession(session.id)).catch((e) => toast({ message: describeStorageError(e), tone: 'error' }))}
          >
            {paused ? 'Reanudar' : 'Pausar'}
          </Button>
          <Button variant="primary" disabled={!lock.canEdit} onClick={() => setFinishOpen(true)}>
            Finalizar
          </Button>
        </div>
      </div>

      {lock.state === 'viewer' && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-warn bg-warn/10 p-3 text-sm" role="alert">
          <span className="flex-1">Esta sesión se está editando en otra pestaña o ventana. Aquí solo puedes verla.</span>
          <Button size="sm" onClick={lock.takeControl}>
            Tomar el control aquí
          </Button>
        </div>
      )}

      <nav aria-label="Ejercicios de la sesión" className="-mx-4 overflow-x-auto px-4">
        <ol className="flex gap-2 pb-1">
          {ses.map((se, i) => {
            const pending = pendingCount(se, byExercise.get(se.id) ?? []);
            const isCur = se.id === cur?.id;
            return (
              <li key={se.id}>
                <button
                  type="button"
                  onClick={() => setCurrent(se.id)}
                  aria-current={isCur ? 'step' : undefined}
                  className={`flex min-h-12 max-w-48 flex-col items-start rounded-xl border px-3 py-1.5 text-left text-xs ${isCur ? 'border-accent bg-accent/10' : 'border-line bg-surface'}`}
                >
                  <span className="font-semibold">
                    {i + 1}. {pending === 0 ? '✓ ' : ''}
                    <span className="line-clamp-1">{se.variant.name}</span>
                  </span>
                  <span className="text-muted">{pending === 0 ? 'Completo' : `${pending} pendiente${pending === 1 ? '' : 's'}`}</span>
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" disabled={!lock.canEdit} onClick={() => setAddOpen(true)} className="min-h-12 rounded-xl border border-dashed border-line px-3 text-xs text-muted">
              + Añadir ejercicio
            </button>
          </li>
        </ol>
      </nav>

      {cur ? (
        <div key={cur.id} className="anim-fade">
          <ExercisePanel session={session} se={cur} sets={byExercise.get(cur.id) ?? []} canEdit={lock.canEdit} />
          <div className="mt-4 flex justify-between gap-2">
            <Button disabled={idx <= 0} onClick={() => setCurrent(ses[idx - 1]!.id)}>
              ← Anterior
            </Button>
            {idx < ses.length - 1 ? (
              <Button variant="primary" onClick={() => setCurrent(ses[idx + 1]!.id)}>
                Siguiente ejercicio →
              </Button>
            ) : (
              <Button variant="primary" disabled={!lock.canEdit} onClick={() => setFinishOpen(true)}>
                Finalizar sesión
              </Button>
            )}
          </div>
        </div>
      ) : (
        <EmptyState title="Esta sesión no tiene ejercicios" action={<Button onClick={() => setAddOpen(true)}>Añadir ejercicio</Button>} />
      )}

      <p className="text-xs text-faint">
        Todo se guarda en este dispositivo al confirmar cada serie. Puedes recargar o cerrar la app y retomar aquí. <Pill>Sesión {session.id.slice(0, 8)}</Pill>
      </p>

      <RestTimerBar sessionId={session.id} canEdit={lock.canEdit} />
      <FinishDialog
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        session={session}
        onDone={(id) => {
          setFinishOpen(false);
          navigate(`/historial/${id}`);
        }}
      />
      <AddExerciseDialog open={addOpen} onClose={() => setAddOpen(false)} sessionId={session.id} onAdded={(id) => setCurrent(id)} />
    </div>
  );
}

function pendingCount(se: SessionExercise, sets: SetLog[]): number {
  const perSide = se.variant.laterality === 'unilateral' && se.unilateralLogging === 'per-side-rows' ? 2 : 1;
  const done = sets.filter((s) => s.sessionExerciseId === se.id && s.deletedAt === null && s.kind === 'work' && s.status === 'completed').length;
  return Math.max(0, se.prescribed.sets * perSide - done);
}
