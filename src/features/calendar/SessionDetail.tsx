import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { formatDuration, formatLocalDate, formatTimeOfDay } from '../../domain/dates';
import { comparisonKeyOf, loadContextOf, setVolumeKg } from '../../domain/load';
import { computePRs, PR_LABEL, PR_STATUS_LABEL } from '../../domain/pr';
import { sessionActiveMs, totalPausedMs } from '../../domain/timer';
import { formatDecimal } from '../../domain/validation';
import { db } from '../../data/db';
import { addSet, prEntries, setSessionStatus, updateSessionNotes } from '../../data/sessions';
import { Button, Card, EmptyState, Loading, Pill } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { SetRow } from '../session/SetRow';

const STATUS_LABEL = { active: 'En curso', completed: 'Completada', partial: 'Parcial', discarded: 'Descartada' } as const;

/** Detalle de una sesión registrada. Permite corregirla avisando que se recalculan las estadísticas. */
export function SessionDetail() {
  const { sessionId } = useParams();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const data = useLiveQuery(async () => {
    if (!sessionId) return null;
    const session = await db.sessions.get(sessionId);
    if (!session) return null;
    const ses = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
    const sets = (await db.setLogs.where('sessionId').equals(sessionId).toArray()).filter((s) => s.deletedAt === null);
    const cardio = await db.cardioLogs.where('date').equals(session.localDate).toArray();
    const pr = computePRs(await prEntries());
    return { session, ses, sets, cardio: cardio.filter((c) => c.sessionId === sessionId), events: pr.events.filter((e) => e.sessionId === sessionId) };
  }, [sessionId]);

  if (data === undefined) return <Loading />;
  if (!data) return <EmptyState title="Sesión no encontrada" action={<Link to="/calendario" className="text-accent underline">Volver al calendario</Link>} />;
  const { session, ses, sets, events, cardio } = data;
  const end = session.endedAt ? Date.parse(session.endedAt) : Date.now();
  const historical = session.status !== 'active';

  return (
    <div className="flex flex-col gap-4">
      <Link to="/calendario" className="text-sm text-accent underline">
        ← Calendario
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{session.title}</h1>
        <p className="text-muted">
          {formatLocalDate(session.localDate, 'long')} · {formatTimeOfDay(session.startedAt, session.timeZone)}
          {session.endedAt ? `–${formatTimeOfDay(session.endedAt, session.timeZone)}` : ''}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Pill tone={session.status === 'completed' ? 'ok' : session.status === 'partial' ? 'warn' : session.status === 'discarded' ? 'danger' : 'info'}>{STATUS_LABEL[session.status]}</Pill>
          <Pill>Tiempo activo {formatDuration(sessionActiveMs(session.startedAt, session.endedAt, session.pauses, end))}</Pill>
          {totalPausedMs(session.pauses, end) > 0 && <Pill>Pausas {formatDuration(totalPausedMs(session.pauses, end))}</Pill>}
          {session.adaptation && <Pill tone="info">Adaptación</Pill>}
        </div>
      </div>

      {session.status === 'active' && (
        <Link to="/sesion" className="rounded-xl bg-accent px-4 py-3 text-center font-semibold text-accent-ink">
          Continuar esta sesión
        </Link>
      )}

      {events.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Marcas de esta sesión</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {events
              .filter((e) => e.type !== 'reps-at-load')
              .map((e) => (
                <li key={`${e.setId}-${e.type}`} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {PR_STATUS_LABEL[e.status]} · {PR_LABEL[e.type]} · {ses.find((s) => comparisonKeyOf(s).key === e.key)?.variant.name}
                  </span>
                  <span className="tabular text-muted">
                    {formatDecimal(e.value)} {e.type === 'max-load' ? 'kg' : e.type === 'max-duration' ? 's' : 'kg·rep'}
                    {e.previous !== null ? ` (antes ${formatDecimal(e.previous)})` : ''}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}

      {historical && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3 text-sm">
          {editing ? (
            <>
              <span className="flex-1 text-warn">Modo corrección: los cambios recalculan récords, volumen y progreso.</span>
              <Button size="sm" onClick={() => setEditing(false)}>
                Terminar corrección
              </Button>
            </>
          ) : (
            <>
              <span className="flex-1 text-muted">¿Algo quedó mal registrado?</span>
              <Button size="sm" onClick={() => setEditing(true)}>
                Corregir sesión
              </Button>
            </>
          )}
          {editing && session.status !== 'discarded' && (
            <Button size="sm" onClick={() => setSessionStatus(session.id, session.status === 'completed' ? 'partial' : 'completed').then(() => toast({ message: 'Estado actualizado.', tone: 'ok' }))}>
              Marcar como {session.status === 'completed' ? 'parcial' : 'completada'}
            </Button>
          )}
        </div>
      )}

      {ses.map((se) => {
        const own = sets.filter((s) => s.sessionExerciseId === se.id).sort((a, b) => a.order - b.order);
        const vol = own
          .filter((s) => s.kind === 'work' && s.status === 'completed')
          .reduce((acc, s) => acc + (setVolumeKg(s, { ...loadContextOf(se), unit: s.unit }) ?? 0), 0);
        let n = 0;
        return (
          <Card key={se.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-semibold">
                <Link to={`/biblioteca/${se.variantId}`} className="underline-offset-2 hover:underline">
                  {se.variant.name}
                </Link>
              </h2>
              {se.variant.measure === 'reps' && vol > 0 && <span className="text-sm text-muted tabular">Volumen registrado {formatDecimal(Math.round(vol * 10) / 10)} kg·rep</span>}
            </div>
            {!comparisonKeyOf(se).confirmed && <p className="text-xs text-warn">Máquina sin identificar: comparabilidad no confirmada.</p>}
            {editing ? (
              <>
                <ol className="flex flex-col gap-2">
                  {own.map((s) => (
                    <SetRow key={s.id} set={s} index={0} se={se} canEdit historical workNumber={s.kind === 'work' ? ++n : null} />
                  ))}
                </ol>
                <Button size="sm" onClick={() => addSet(se.id, 'work')}>
                  + Serie
                </Button>
              </>
            ) : (
              <ul className="text-sm tabular">
                {own.map((s) => (
                  <li key={s.id} className={s.status === 'completed' ? '' : 'text-faint'}>
                    {s.kind === 'warmup' ? 'Calentamiento' : `Serie ${++n}`}
                    {s.side ? ` (${s.side === 'left' ? 'izq.' : 'der.'})` : ''}: {s.load === null ? 'carga no registrada' : `${formatDecimal(s.load)} ${s.unit}`} ×{' '}
                    {s.reps ?? (s.durationSec !== null ? `${s.durationSec} s` : '—')}
                    {s.rir !== null ? ` · RIR ${formatDecimal(s.rir)}` : ''}
                    {s.status !== 'completed' && ' · no realizada (borrador)'}
                  </li>
                ))}
              </ul>
            )}
            {se.notes && <p className="text-sm text-muted">Nota: {se.notes}</p>}
            {se.painReported && <p className="text-sm text-danger">Se registró dolor inusual.</p>}
          </Card>
        );
      })}

      {cardio.length > 0 && (
        <Card>
          <h2 className="mb-1 font-semibold">Cardio</h2>
          {cardio.map((c) => (
            <p key={c.id} className="text-sm">
              {c.modality}: {formatDecimal(c.durationMin)} min{c.distanceKm !== null ? ` · ${formatDecimal(c.distanceKm)} km` : ''}
            </p>
          ))}
        </Card>
      )}

      <NotesCard initial={session.notes} onSave={(n) => updateSessionNotes(session.id, n).then(() => toast({ message: 'Notas guardadas.', tone: 'ok' }))} />
    </div>
  );
}

function NotesCard({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(initial);
  return (
    <Card>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold">Notas de la sesión</span>
        <textarea className="min-h-20 rounded-lg border border-line bg-surface-2 p-2" value={text} onChange={(e) => setText(e.target.value)} onBlur={() => text !== initial && onSave(text)} />
      </label>
    </Card>
  );
}
