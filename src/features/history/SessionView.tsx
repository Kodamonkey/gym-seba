import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { discardSession } from '../../data/sessions';
import { sessionSummary } from '../../data/overview';
import { Button, Dialog, Loading, PageHeader } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { longDate, loadColumn, sessionMinutes, setText } from '../shared';

/** Un entrenamiento guardado: cada ejercicio con sus series hechas. */
export function SessionView() {
  const { sessionId = '' } = useParams();
  const summary = useLiveQuery(async () => (await sessionSummary(sessionId)) ?? null, [sessionId]);
  const navigate = useNavigate();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);

  if (summary === undefined) return <Loading />;
  if (!summary || summary.session.status === 'discarded' || summary.session.status === 'active') {
    return (
      <>
        <PageHeader back="/historial" />
        <p className="py-10 text-muted">Este entrenamiento no está en el historial.</p>
      </>
    );
  }
  const { session, exercises, doneSets } = summary;

  return (
    <div>
      <PageHeader back="/historial" />
      <p className="text-sm text-muted first-letter:uppercase">{longDate(session.localDate)}</p>
      <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">{session.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {doneSets} series · {sessionMinutes(session)}
        {session.status === 'partial' ? ' · parcial' : ''}
      </p>

      <ul className="mt-4 divide-y divide-line">
        {exercises
          .filter((e) => e.sets.length > 0)
          .map(({ se, sets }) => {
            const unit = loadColumn(se.variant, se.unit);
            return (
              <li key={se.id} className="py-4">
                <p className="text-[16px] font-medium">{se.variant.name}</p>
                <ol className="mt-1.5 flex flex-wrap gap-1.5">
                  {sets.map((s) => (
                    <li key={s.id} className="rounded-lg bg-surface-2 px-2.5 py-1 text-[14px] font-medium tabular">
                      {setText(s)}
                    </li>
                  ))}
                </ol>
                {unit !== 'kg' && sets.some((s) => s.load !== null) && <p className="mt-1 text-[12px] text-muted">{unit} × reps</p>}
              </li>
            );
          })}
      </ul>
      {doneSets === 0 && <p className="py-6 text-muted">Sin series registradas.</p>}

      {session.notes && <p className="mt-4 whitespace-pre-wrap rounded-2xl bg-surface-2 p-4 text-[15px]">{session.notes}</p>}

      <Button variant="danger" className="mt-6" onClick={() => setConfirm(true)}>
        Eliminar del historial
      </Button>
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Eliminar del historial?"
        footer={
          <>
            <Button
              size="lg"
              variant="destructive"
              onClick={async () => {
                await discardSession(session.id);
                toast({ message: 'Entrenamiento eliminado del historial.' });
                navigate('/historial', { replace: true });
              }}
            >
              Sí, eliminar
            </Button>
            <Button size="lg" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
          </>
        }
      >
        <p className="text-[15px] text-muted">Dejará de contar para tu historial y la semana. Si exportas un respaldo, se conserva marcado como descartado.</p>
      </Dialog>
    </div>
  );
}
