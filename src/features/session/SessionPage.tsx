import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useActiveSession, useEditorLock, useNow, usePrefs } from '../../app/hooks';
import { formatDuration } from '../../domain/dates';
import { sessionActiveMs } from '../../domain/timer';
import type { SetLog } from '../../domain/types';
import { db } from '../../data/db';
import { Button, Loading, PageHeader } from '../../ui/primitives';
import { TechniqueSheet } from '../exercise/TechniqueSheet';
import { ExerciseBlock } from './ExerciseBlock';
import { FinishSheet } from './FinishSheet';
import { RestTimer } from './RestTimer';

/** Entrenamiento en curso: todos los ejercicios en una lista; se recupera tras recargar. */
export function SessionPage() {
  const session = useActiveSession();
  const navigate = useNavigate();
  const prefs = usePrefs();
  const lock = useEditorLock(session?.id);
  const now = useNow(1000, !!session);
  const [finishOpen, setFinishOpen] = useState(false);
  const [tech, setTech] = useState<string | null>(null);

  const data = useLiveQuery(async () => {
    if (!session) return null;
    const ses = await db.sessionExercises.where('sessionId').equals(session.id).sortBy('order');
    const sets = await db.setLogs.where('sessionId').equals(session.id).toArray();
    return { ses, sets };
  }, [session?.id]);

  // Mantener la pantalla encendida (si está activado y el navegador lo permite).
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

  if (session === undefined || (session && !data)) return <Loading label="Recuperando el entrenamiento…" />;
  if (!session) {
    return (
      <>
        <PageHeader back="/" />
        <div className="flex flex-col items-start gap-3 py-10">
          <p className="text-lg font-semibold">No hay un entrenamiento en curso</p>
          <Link to="/" className="font-medium underline underline-offset-4">
            Ir al inicio
          </Link>
        </div>
      </>
    );
  }

  let expected = 0;
  let done = 0;
  for (const se of data!.ses) {
    const rows = se.prescribed.sets * (se.variant.laterality === 'unilateral' && se.unilateralLogging === 'per-side-rows' ? 2 : 1);
    const sets = byExercise.get(se.id) ?? [];
    expected += rows;
    done += Math.min(rows, sets.filter((s) => s.deletedAt === null && s.kind === 'work' && s.status === 'completed').length);
  }
  const elapsed = sessionActiveMs(session.startedAt, session.endedAt, session.pauses, now);

  return (
    <div className="pb-28">
      <PageHeader
        back="/"
        title={session.title}
        subtitle={`${formatDuration(elapsed)} · ${done}/${expected} series`}
        progress={expected ? done / expected : 0}
        action={
          <Button size="sm" variant="primary" className="mr-1" disabled={!lock.canEdit} onClick={() => setFinishOpen(true)}>
            Terminar
          </Button>
        }
      />

      {lock.state === 'viewer' && (
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-warn/10 p-3 text-sm" role="alert">
          <span className="flex-1">Este entrenamiento está abierto en otra pestaña. Aquí solo puedes verlo.</span>
          <Button size="sm" onClick={lock.takeControl}>
            Usar aquí
          </Button>
        </div>
      )}

      {data!.ses.map((se) => (
        <ExerciseBlock key={se.id} session={session} se={se} sets={byExercise.get(se.id) ?? []} canEdit={lock.canEdit} onTechnique={setTech} />
      ))}

      {done >= expected && expected > 0 && (
        <Button variant="primary" size="lg" className="mt-4 w-full" disabled={!lock.canEdit} onClick={() => setFinishOpen(true)}>
          Terminar entrenamiento
        </Button>
      )}

      <RestTimer sessionId={session.id} canEdit={lock.canEdit} />
      <TechniqueSheet variantId={tech} onClose={() => setTech(null)} />
      <FinishSheet open={finishOpen} onClose={() => setFinishOpen(false)} session={session} done={done} expected={expected} onDone={() => navigate('/', { replace: true })} />
    </div>
  );
}
