import { useState } from 'react';
import type { WorkoutSession } from '../../domain/types';
import { userMessage } from '../../data/db';
import { discardSession, finishSession } from '../../data/sessions';
import { Button, Dialog } from '../../ui/primitives';
import { useToast } from '../../ui/toast';

/**
 * Terminar: guarda como completa si están todas las series hechas, o como parcial si no.
 * Las series sin marcar no cuentan como realizadas.
 */
export function FinishSheet({
  open,
  onClose,
  session,
  done,
  expected,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  session: WorkoutSession;
  done: number;
  expected: number;
  onDone: () => void;
}) {
  const toast = useToast();
  const [discarding, setDiscarding] = useState(false);
  const [busy, setBusy] = useState(false);
  const complete = expected > 0 && done >= expected;

  const close = () => {
    setDiscarding(false);
    onClose();
  };

  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast({ message });
      onDone();
    } catch (e) {
      toast({ message: userMessage(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  const save = () => run(() => finishSession(session.id, complete ? 'completed' : 'partial'), 'Entrenamiento guardado.');
  const discard = () => run(() => discardSession(session.id), 'Entrenamiento descartado.');

  const footer = discarding ? (
    <>
      <Button size="lg" variant="destructive" busy={busy} onClick={discard}>
        Sí, descartar
      </Button>
      <Button size="lg" onClick={() => setDiscarding(false)}>
        Cancelar
      </Button>
    </>
  ) : (
    <>
      {done > 0 ? (
        <Button variant="primary" size="lg" busy={busy} onClick={save}>
          Guardar
        </Button>
      ) : (
        <Button variant="primary" size="lg" busy={busy} onClick={discard}>
          Salir sin guardar
        </Button>
      )}
      <Button size="lg" onClick={close}>
        Seguir entrenando
      </Button>
      {done > 0 && (
        <Button variant="danger" onClick={() => setDiscarding(true)}>
          Descartar
        </Button>
      )}
    </>
  );

  return (
    <Dialog open={open} onClose={close} title={discarding ? '¿Descartar entrenamiento?' : 'Terminar entrenamiento'} footer={footer}>
      {discarding ? (
        <p className="text-[15px] text-muted">No aparecerá en tu historial ni contará para la semana.</p>
      ) : (
        <>
          <p className="text-[34px] font-bold leading-none tabular">
            {done}
            <span className="text-xl font-semibold text-muted"> / {expected} series</span>
          </p>
          <p className="mt-2 text-[15px] text-muted">
            {done === 0 ? 'Aún no marcaste ninguna serie.' : complete ? '¡Completo! Buen trabajo.' : 'Se guardará como parcial. Las series sin marcar no cuentan.'}
          </p>
        </>
      )}
    </Dialog>
  );
}
