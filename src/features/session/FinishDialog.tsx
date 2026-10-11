import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import type { WorkoutSession } from '../../domain/types';
import { parseDecimal } from '../../domain/validation';
import { db, nowIso, uid, userMessage } from '../../data/db';
import { discardSession, finishSession, sessionCompleteness, updateSessionNotes } from '../../data/sessions';
import { Button, Dialog, Field } from '../../ui/primitives';
import { useToast } from '../../ui/toast';

/** Finalizar no marca como realizadas las series pendientes. */
export function FinishDialog({ open, onClose, session, onDone }: { open: boolean; onClose: () => void; session: WorkoutSession; onDone: (id: string) => void }) {
  const toast = useToast();
  const completeness = useLiveQuery(() => (open ? sessionCompleteness(session.id) : undefined), [open, session.id]);
  const [notes, setNotes] = useState(session.notes);
  const [cardioMin, setCardioMin] = useState('');
  const [cardioKm, setCardioKm] = useState('');
  const [cardioType, setCardioType] = useState('Cinta');
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const complete = !!completeness && completeness.expected > 0 && completeness.done >= completeness.expected;

  async function finish(status: 'completed' | 'partial') {
    const m = parseDecimal(cardioMin, 'La duración');
    const k = parseDecimal(cardioKm, 'La distancia');
    if (!m.ok || !k.ok) {
      setErr(!m.ok ? m.error : !k.ok ? k.error : null);
      return;
    }
    setBusy(true);
    try {
      if (notes !== session.notes) await updateSessionNotes(session.id, notes);
      if (m.value !== null && m.value > 0) {
        const now = nowIso();
        await db.cardioLogs.add({ id: uid(), date: session.localDate, sessionId: session.id, modality: cardioType, durationMin: m.value, distanceKm: k.value, rpe: null, notes: '', createdAt: now, updatedAt: now });
      }
      await finishSession(session.id, status);
      toast({ message: status === 'completed' ? 'Sesión completada y guardada.' : 'Sesión guardada como parcial.', tone: 'ok' });
      onDone(session.id);
    } catch (e) {
      setErr(userMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Finalizar sesión">
      {completeness && (
        <p className="mb-3">
          Series de trabajo confirmadas: <strong className="tabular">{completeness.done}</strong> de {completeness.expected} prescritas.
          {completeness.pendingDrafts > 0 && (
            <span className="block text-sm text-muted">Las {completeness.pendingDrafts} series sin confirmar no se contarán como realizadas.</span>
          )}
        </p>
      )}
      <label className="mb-3 flex flex-col gap-1 text-sm">
        <span className="text-muted">Notas de la sesión</span>
        <textarea className="min-h-16 rounded-lg border border-line bg-surface-2 p-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <fieldset className="mb-3 rounded-xl border border-line p-3">
        <legend className="px-1 text-sm text-muted">Cardio (opcional)</legend>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Tipo" value={cardioType} onChange={(e) => setCardioType(e.target.value)} />
          <Field label="Minutos" inputMode="decimal" value={cardioMin} onChange={(e) => setCardioMin(e.target.value)} />
          <Field label="Km" inputMode="decimal" value={cardioKm} onChange={(e) => setCardioKm(e.target.value)} />
        </div>
      </fieldset>
      {err && (
        <p className="mb-2 text-sm text-danger" role="alert">
          {err}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button variant="primary" size="lg" busy={busy} disabled={!complete} onClick={() => finish('completed')}>
          Finalizar como completada
        </Button>
        {!complete && <p className="text-xs text-muted">Para marcarla completada deben estar confirmadas todas las series de trabajo prescritas.</p>}
        <Button size="lg" busy={busy} onClick={() => finish('partial')}>
          Finalizar como parcial
        </Button>
        {!confirmDiscard ? (
          <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>
            Descartar sesión…
          </Button>
        ) : (
          <div className="rounded-xl border border-danger p-3 text-sm">
            <p className="mb-2">
              La sesión quedará marcada como descartada: no contará en progreso ni récords, pero sus datos no se borran y aparecerá en el historial.
            </p>
            <Button
              variant="danger"
              onClick={async () => {
                await discardSession(session.id);
                toast({ message: 'Sesión descartada.', tone: 'ok' });
                onDone(session.id);
              }}
            >
              Sí, descartar
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
