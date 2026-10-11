import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db, describeStorageError } from '../../data/db';
import { addExerciseToSession } from '../../data/sessions';
import { Button, Dialog, Field, Select } from '../../ui/primitives';
import { useToast } from '../../ui/toast';

export function AddExerciseDialog({ open, onClose, sessionId, onAdded }: { open: boolean; onClose: () => void; sessionId: string; onAdded: (id: string) => void }) {
  const toast = useToast();
  const variants = useLiveQuery(() => db.variants.toArray(), []);
  const [variantId, setVariantId] = useState('');
  const [sets, setSets] = useState('2');
  const [repMin, setRepMin] = useState('10');
  const [repMax, setRepMax] = useState('12');
  const [rest, setRest] = useState('60');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Añadir ejercicio a esta sesión"
      footer={
        <Button
          variant="primary"
          disabled={!variantId}
          onClick={async () => {
            const n = (x: string, d: number) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.round(Number(x)) : d);
            try {
              const id = await addExerciseToSession(sessionId, variantId, {
                sets: n(sets, 2),
                repMin: n(repMin, 10),
                repMax: Math.max(n(repMin, 10), n(repMax, 12)),
                durationMin: 20,
                durationMax: 30,
                repsMode: 'total',
                restSec: n(rest, 60),
                rirMin: 2,
                rirMax: 3,
              });
              onAdded(id);
              onClose();
            } catch (e) {
              toast({ message: describeStorageError(e), tone: 'error' });
            }
          }}
        >
          Añadir
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Select
          label="Variante"
          value={variantId}
          onChange={setVariantId}
          options={[{ value: '', label: 'Elige…' }, ...(variants ?? []).filter((v) => !v.archived).map((v) => ({ value: v.id, label: v.name }))]}
        />
        <div className="grid grid-cols-4 gap-2">
          <Field label="Series" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
          <Field label="Rep. mín." inputMode="numeric" value={repMin} onChange={(e) => setRepMin(e.target.value)} />
          <Field label="Rep. máx." inputMode="numeric" value={repMax} onChange={(e) => setRepMax(e.target.value)} />
          <Field label="Descanso (s)" inputMode="numeric" value={rest} onChange={(e) => setRest(e.target.value)} />
        </div>
        <p className="text-xs text-faint">Solo afecta a esta sesión; la plantilla no cambia.</p>
      </div>
    </Dialog>
  );
}
