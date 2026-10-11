import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useToday } from '../../app/hooks';
import type { ExerciseVariant, PrescribedExercise, RoutineDay } from '../../domain/types';
import { db, describeStorageError, uid } from '../../data/db';
import { saveTemplate, syncProgramDays } from '../../data/program';
import { Button, Card, Dialog, EmptyState, Field, Loading, Select } from '../../ui/primitives';
import { useToast } from '../../ui/toast';

function intOr(v: string, fallback: number, min = 0): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= min ? n : fallback;
}

/** Editor de un día de la plantilla. Guardar crea una versión nueva; no altera sesiones pasadas. */
export function DayEditor() {
  const { dayId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const today = useToday();
  const data = useLiveQuery(async () => {
    const program = await db.programs.where('status').equals('active').first();
    const template = program ? await db.routineTemplates.get(program.templateId) : (await db.routineTemplates.toArray())[0];
    return { program, template, variants: (await db.variants.toArray()).filter((v) => !v.archived) };
  }, []);
  const [day, setDay] = useState<RoutineDay | null>(null);
  const [altFor, setAltFor] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const d = data?.template?.days.find((x) => x.id === dayId);
    if (d && !day) setDay(structuredClone(d));
  }, [data, dayId, day]);

  if (!data) return <Loading />;
  if (!data.template || !day) return <EmptyState title="Día no encontrado" action={<Link to="/rutina" className="text-accent underline">Volver</Link>} />;
  const variants = data.variants;
  const vById = new Map(variants.map((v) => [v.id, v]));

  const patchEx = (id: string, p: Partial<PrescribedExercise>) => setDay((d) => d && { ...d, exercises: d.exercises.map((e) => (e.id === id ? { ...e, ...p } : e)) });
  const move = (i: number, dir: -1 | 1) =>
    setDay((d) => {
      if (!d) return d;
      const xs = [...d.exercises];
      const j = i + dir;
      if (j < 0 || j >= xs.length) return d;
      [xs[i], xs[j]] = [xs[j]!, xs[i]!];
      return { ...d, exercises: xs };
    });

  async function save() {
    if (!day || !data?.template) return;
    const errs: string[] = [];
    if (!day.name.trim()) errs.push('El día necesita un nombre.');
    day.exercises.forEach((e, i) => {
      const v = vById.get(e.variantId);
      if (!v) errs.push(`Ejercicio ${i + 1}: elige una variante.`);
      if (e.sets < 1) errs.push(`Ejercicio ${i + 1}: al menos 1 serie.`);
      if (v?.measure !== 'time' && (e.repMin < 1 || e.repMax < e.repMin)) errs.push(`Ejercicio ${i + 1}: rango de repeticiones inválido.`);
      if (e.rirMax < e.rirMin) errs.push(`Ejercicio ${i + 1}: RIR mínimo mayor que el máximo.`);
    });
    setErrors(errs);
    if (errs.length) return;
    try {
      await saveTemplate({ ...data.template, days: data.template.days.map((d) => (d.id === day.id ? day : d)) });
      toast({ message: 'Día guardado (nueva versión de la plantilla). Las sesiones registradas no cambian.', tone: 'ok' });
      navigate('/rutina');
    } catch (e) {
      toast({ message: describeStorageError(e), tone: 'error' });
    }
  }

  async function removeDay() {
    if (!data?.template || !day) return;
    await saveTemplate({ ...data.template, days: data.template.days.filter((d) => d.id !== day.id) });
    if (data.program) await syncProgramDays(data.program.id, today);
    toast({ message: 'Día eliminado de la plantilla. Las sesiones registradas se conservan.', tone: 'ok' });
    navigate('/rutina');
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Editar día</h1>
        <Link to="/rutina" className="text-sm text-accent underline">
          Cancelar
        </Link>
      </div>
      <Card className="flex flex-col gap-3">
        <Field label="Nombre del día" value={day.name} onChange={(e) => setDay({ ...day, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['warmupMin', 'strengthMin', 'cardioMin', 'cooldownMin'] as const).map((k) => (
            <Field
              key={k}
              label={{ warmupMin: 'Calentamiento', strengthMin: 'Fuerza', cardioMin: 'Cardio', cooldownMin: 'Cierre' }[k]}
              suffix="min"
              inputMode="numeric"
              value={String(day.timeSplit[k])}
              onChange={(e) => setDay({ ...day, timeSplit: { ...day.timeSplit, [k]: intOr(e.target.value, 0) } })}
            />
          ))}
        </div>
        <p className="text-xs text-faint">Distribución orientativa. No se acortan descansos ni se eliminan series para ajustar el tiempo.</p>
      </Card>

      {day.exercises.map((ex, i) => {
        const v = vById.get(ex.variantId);
        return (
          <Card key={ex.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">Ejercicio {i + 1}</h2>
              <div className="flex gap-1">
                <Button size="sm" onClick={() => move(i, -1)} aria-label="Subir ejercicio" disabled={i === 0}>
                  ↑
                </Button>
                <Button size="sm" onClick={() => move(i, 1)} aria-label="Bajar ejercicio" disabled={i === day.exercises.length - 1}>
                  ↓
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setDay({ ...day, exercises: day.exercises.filter((e) => e.id !== ex.id) })}>
                  Quitar
                </Button>
              </div>
            </div>
            <Select label="Variante" value={ex.variantId} onChange={(val) => patchEx(ex.id, { variantId: val })} options={variants.map((x) => ({ value: x.id, label: x.name }))} />
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              <Field label="Series" inputMode="numeric" value={String(ex.sets)} onChange={(e) => patchEx(ex.id, { sets: intOr(e.target.value, ex.sets, 1) })} />
              {v?.measure === 'time' ? (
                <>
                  <Field label="Seg. mín." inputMode="numeric" value={String(ex.durationMin ?? '')} onChange={(e) => patchEx(ex.id, { durationMin: intOr(e.target.value, ex.durationMin ?? 20, 1) })} />
                  <Field label="Seg. máx." inputMode="numeric" value={String(ex.durationMax ?? '')} onChange={(e) => patchEx(ex.id, { durationMax: intOr(e.target.value, ex.durationMax ?? 30, 1) })} />
                </>
              ) : (
                <>
                  <Field label="Rep. mín." inputMode="numeric" value={String(ex.repMin)} onChange={(e) => patchEx(ex.id, { repMin: intOr(e.target.value, ex.repMin, 1) })} />
                  <Field label="Rep. máx." inputMode="numeric" value={String(ex.repMax)} onChange={(e) => patchEx(ex.id, { repMax: intOr(e.target.value, ex.repMax, 1) })} />
                </>
              )}
              <Field label="Descanso" suffix="s" inputMode="numeric" value={String(ex.restSec)} onChange={(e) => patchEx(ex.id, { restSec: intOr(e.target.value, ex.restSec) })} />
              <Field label="RIR mín." inputMode="numeric" value={String(ex.rirMin)} onChange={(e) => patchEx(ex.id, { rirMin: intOr(e.target.value, ex.rirMin) })} />
              <Field label="RIR máx." inputMode="numeric" value={String(ex.rirMax)} onChange={(e) => patchEx(ex.id, { rirMax: intOr(e.target.value, ex.rirMax) })} />
            </div>
            {v?.laterality === 'unilateral' && (
              <Select
                label="Repeticiones"
                value={ex.repsMode}
                onChange={(val) => patchEx(ex.id, { repsMode: val as PrescribedExercise['repsMode'] })}
                options={[
                  { value: 'per-side', label: 'Por lado' },
                  { value: 'total', label: 'Totales' },
                ]}
              />
            )}
            <div className="text-sm">
              <p className="text-muted">Alternativas: {ex.alternativeVariantIds.length ? ex.alternativeVariantIds.map((a) => vById.get(a)?.name ?? '—').join(', ') : 'ninguna'}</p>
              <Button size="sm" className="mt-1" onClick={() => setAltFor(ex.id)}>
                Elegir alternativas
              </Button>
            </div>
            <Field label="Nota si no hay sustitución directa (opcional)" value={ex.noDirectAlternativeNote ?? ''} onChange={(e) => patchEx(ex.id, { noDirectAlternativeNote: e.target.value || undefined } as Partial<PrescribedExercise>)} />
          </Card>
        );
      })}

      <Button
        onClick={() =>
          setDay({
            ...day,
            exercises: [
              ...day.exercises,
              { id: uid(), variantId: variants[0]!.id, sets: 2, repMin: 10, repMax: 12, repsMode: 'total', restSec: 60, rirMin: 2, rirMax: 3, alternativeVariantIds: [], notes: '' },
            ],
          })
        }
      >
        + Añadir ejercicio
      </Button>

      {errors.length > 0 && (
        <ul className="list-disc rounded-xl border border-danger p-3 pl-8 text-sm text-danger" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="lg" onClick={save}>
          Guardar día
        </Button>
        <Button variant="ghost" onClick={() => setRemoving(true)}>
          Eliminar este día…
        </Button>
      </div>

      <AltDialog
        open={!!altFor}
        onClose={() => setAltFor(null)}
        variants={variants}
        current={day.exercises.find((e) => e.id === altFor)}
        onChange={(ids) => altFor && patchEx(altFor, { alternativeVariantIds: ids })}
      />
      <Dialog
        open={removing}
        onClose={() => setRemoving(false)}
        title="Eliminar día"
        footer={
          <Button variant="danger" onClick={() => removeDay().catch((e) => toast({ message: describeStorageError(e), tone: 'error' }))}>
            Eliminar día
          </Button>
        }
      >
        <p className="text-sm">Se quitará de la plantilla y de las sesiones futuras sin registro. Las sesiones ya registradas se conservan con su copia.</p>
      </Dialog>
    </div>
  );
}

function AltDialog({ open, onClose, variants, current, onChange }: { open: boolean; onClose: () => void; variants: ExerciseVariant[]; current?: PrescribedExercise | undefined; onChange: (ids: string[]) => void }) {
  if (!current) return null;
  const ids = current.alternativeVariantIds;
  return (
    <Dialog open={open} onClose={onClose} title="Alternativas seleccionables" footer={<Button variant="primary" onClick={onClose}>Listo</Button>}>
      <p className="mb-2 text-sm text-muted">Las alternativas deben ser variantes concretas. No se transfieren pesos entre ellas.</p>
      <div className="flex flex-col gap-1">
        {variants
          .filter((v) => v.id !== current.variantId)
          .map((v) => (
            <label key={v.id} className="flex min-h-10 items-center gap-2 text-sm">
              <input type="checkbox" checked={ids.includes(v.id)} onChange={(e) => onChange(e.target.checked ? [...ids, v.id] : ids.filter((x) => x !== v.id))} />
              {v.name}
            </label>
          ))}
      </div>
    </Dialog>
  );
}
