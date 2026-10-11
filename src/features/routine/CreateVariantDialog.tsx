import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { EquipmentKind, ExerciseVariant, Laterality, LoadConvention, MeasureKind, MuscleRole } from '../../domain/types';
import { db, nowIso, uid, userMessage } from '../../data/db';
import { MUSCLES } from '../../data/seed/muscles';
import { Button, Dialog, Field, Select } from '../../ui/primitives';
import { useToast } from '../../ui/toast';

const CONVENTIONS: { value: LoadConvention; label: string }[] = [
  { value: 'machine-stack', label: 'Valor de la pila de la máquina' },
  { value: 'per-implement', label: 'Peso por mancuerna/implemento' },
  { value: 'total-external', label: 'Carga externa total (barra + discos)' },
  { value: 'plates-added', label: 'Discos añadidos' },
  { value: 'nominal', label: 'Resistencia nominal' },
  { value: 'none', label: 'Sin carga externa' },
];

/**
 * Variante propia (p. ej. "otra máquina equivalente, identificada"). No tiene demostración:
 * se muestra como pendiente hasta que se incorpore un medio autorizado.
 */
export function CreateVariantDialog({ open, onClose, baseVariant }: { open: boolean; onClose: () => void; baseVariant?: ExerciseVariant }) {
  const toast = useToast();
  const navigate = useNavigate();
  const exercises = useLiveQuery(() => db.exercises.toArray(), []);
  const [exerciseId, setExerciseId] = useState(baseVariant?.exerciseId ?? '');
  const [newExercise, setNewExercise] = useState('');
  const [name, setName] = useState(baseVariant ? `${baseVariant.name} (otra)` : '');
  const [kind, setKind] = useState<EquipmentKind>(baseVariant?.equipmentKind ?? 'machine');
  const [laterality, setLaterality] = useState<Laterality>(baseVariant?.laterality ?? 'bilateral');
  const [impl, setImpl] = useState<'1' | '2'>(String(baseVariant?.implements ?? 1) as '1' | '2');
  const [conv, setConv] = useState<LoadConvention>(baseVariant?.loadConvention ?? 'machine-stack');
  const [measure, setMeasure] = useState<MeasureKind>(baseVariant?.measure ?? 'reps');
  const [config, setConfig] = useState(baseVariant ? Object.entries(baseVariant.config).map(([k, v]) => `${k}: ${v}`).join('\n') : '');
  const [roles, setRoles] = useState<Record<string, MuscleRole | ''>>(() => Object.fromEntries((baseVariant?.muscles ?? []).map((m) => [m.muscleId, m.role])));
  const [setup, setSetup] = useState('');
  const [execution, setExecution] = useState('');
  const [avoid, setAvoid] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) return setErr('Ponle un nombre que identifique la máquina o el agarre.');
    if (!exerciseId && !newExercise.trim()) return setErr('Elige un ejercicio o crea uno nuevo.');
    const now = nowIso();
    let exId = exerciseId;
    try {
      if (!exId) {
        exId = uid();
        await db.exercises.add({ id: exId, name: newExercise.trim(), archived: false, createdAt: now, updatedAt: now });
      }
      const cfg: Record<string, string> = {};
      for (const line of config.split('\n')) {
        const [k, ...rest] = line.split(':');
        if (k?.trim() && rest.join(':').trim()) cfg[k.trim()] = rest.join(':').trim();
      }
      const v: ExerciseVariant = {
        id: uid(),
        exerciseId: exId,
        name: name.trim(),
        equipmentKind: kind,
        config: cfg,
        laterality,
        implements: impl === '2' ? 2 : 1,
        loadConvention: conv,
        measure,
        requiresEquipmentInstance: kind === 'machine' || kind === 'cable' || kind === 'smith',
        muscles: Object.entries(roles)
          .filter(([, r]) => r)
          .map(([muscleId, role]) => ({ muscleId, role: role as MuscleRole })),
        musclesReviewStatus: 'unreviewed',
        technique: {
          setup: setup.trim() || 'Sin redactar.',
          execution: execution.trim() || 'Sin redactar.',
          avoid: avoid.trim() ? [avoid.trim()] : [],
          more: {},
          authoredBy: 'user',
          reviewStatus: 'unreviewed',
        },
        clipId: null,
        archived: false,
        custom: true,
        createdAt: now,
        updatedAt: now,
      };
      await db.variants.add(v);
      toast({ message: 'Variante creada. Su demostración queda pendiente.', tone: 'ok' });
      onClose();
      navigate(`/biblioteca/${v.id}`);
    } catch (e) {
      setErr(userMessage(e));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Crear variante" footer={<Button variant="primary" onClick={save}>Crear</Button>}>
      <div className="flex flex-col gap-3">
        <Select
          label="Ejercicio"
          value={exerciseId}
          onChange={setExerciseId}
          options={[{ value: '', label: 'Nuevo ejercicio…' }, ...(exercises ?? []).map((e) => ({ value: e.id, label: e.name }))]}
        />
        {!exerciseId && <Field label="Nombre del nuevo ejercicio" value={newExercise} onChange={(e) => setNewExercise(e.target.value)} />}
        <Field label="Nombre de la variante" value={name} onChange={(e) => setName(e.target.value)} hint="Identifica equipo, agarre o posición: p. ej. 'Extensión de cuádriceps, máquina 2 (unilateral)'." />
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Equipo"
            value={kind}
            onChange={(v) => setKind(v as EquipmentKind)}
            options={[
              { value: 'machine', label: 'Máquina' },
              { value: 'cable', label: 'Polea' },
              { value: 'dumbbell', label: 'Mancuernas' },
              { value: 'barbell', label: 'Barra' },
              { value: 'smith', label: 'Smith' },
              { value: 'bodyweight', label: 'Peso corporal / otro' },
            ]}
          />
          <Select label="Lateralidad" value={laterality} onChange={(v) => setLaterality(v as Laterality)} options={[{ value: 'bilateral', label: 'Bilateral' }, { value: 'unilateral', label: 'Unilateral' }]} />
          <Select label="Implementos a la vez" value={impl} onChange={(v) => setImpl(v as '1' | '2')} options={[{ value: '1', label: '1' }, { value: '2', label: '2' }]} />
          <Select label="Se mide por" value={measure} onChange={(v) => setMeasure(v as MeasureKind)} options={[{ value: 'reps', label: 'Repeticiones' }, { value: 'time', label: 'Tiempo' }]} />
        </div>
        <Select label="Convención de carga" value={conv} onChange={(v) => setConv(v as LoadConvention)} options={CONVENTIONS} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Configuración relevante (una por línea, "clave: valor")</span>
          <textarea className="min-h-16 rounded-lg border border-line bg-surface-2 p-2" value={config} onChange={(e) => setConfig(e.target.value)} placeholder={'agarre: neutro\nasiento: alto'} />
        </label>
        <fieldset className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-lg border border-line p-2">
          <legend className="px-1 text-sm text-muted">Músculos y su papel en esta variante</legend>
          {MUSCLES.map((m) => (
            <label key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{m.commonName}</span>
              <select className="min-h-9 rounded bg-surface-2 px-2" value={roles[m.id] ?? ''} onChange={(e) => setRoles((r) => ({ ...r, [m.id]: e.target.value as MuscleRole | '' }))}>
                <option value="">—</option>
                <option value="target">Objetivo</option>
                <option value="synergist">Participa</option>
                <option value="stabilizer">Estabiliza</option>
              </select>
            </label>
          ))}
        </fieldset>
        <Field label="Preparación (una frase)" value={setup} onChange={(e) => setSetup(e.target.value)} />
        <Field label="Ejecución (una frase)" value={execution} onChange={(e) => setExecution(e.target.value)} />
        <Field label="Evita" value={avoid} onChange={(e) => setAvoid(e.target.value)} />
        {err && (
          <p className="text-sm text-danger" role="alert">
            {err}
          </p>
        )}
      </div>
    </Dialog>
  );
}
