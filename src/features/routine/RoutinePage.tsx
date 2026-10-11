import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CLIPS } from '../../anatomy/clips';
import { useToday } from '../../app/hooks';
import { formatLocalDate, weekdayName } from '../../domain/dates';
import { loadLabel } from '../../domain/load';
import type { EquipmentInstance, EquipmentKind, ExerciseVariant, LoadUnit, RoutineTemplate } from '../../domain/types';
import { parseDecimal } from '../../domain/validation';
import { db, nowIso, uid, userMessage } from '../../data/db';
import { saveTemplate, setAdaptationWeeks, setProgramWeekday, syncProgramDays } from '../../data/program';
import { Button, Card, Dialog, EmptyState, Field, Loading, Pill, Select } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { CreateVariantDialog } from './CreateVariantDialog';

const TABS = [
  { id: 'programa', label: 'Programa' },
  { id: 'biblioteca', label: 'Biblioteca' },
  { id: 'equipos', label: 'Equipos' },
] as const;

export function RoutinePage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as (typeof TABS)[number]['id']) ?? 'programa';
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Mi rutina</h1>
      <div role="tablist" aria-label="Secciones de la rutina" className="flex gap-1 rounded-xl bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setParams({ tab: t.id })}
            className={`min-h-11 flex-1 rounded-lg text-sm ${tab === t.id ? 'bg-surface-3 font-semibold' : 'text-muted'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        {tab === 'programa' && <ProgramTab />}
        {tab === 'biblioteca' && <LibraryTab />}
        {tab === 'equipos' && <EquipmentTab />}
      </div>
    </div>
  );
}

/* ---------- Programa ---------- */

function ProgramTab() {
  const today = useToday();
  const toast = useToast();
  const data = useLiveQuery(async () => {
    const program = await db.programs.where('status').equals('active').first();
    const template = program ? await db.routineTemplates.get(program.templateId) : (await db.routineTemplates.toArray())[0];
    const variants = await db.variants.toArray();
    return { program, template, variants: new Map(variants.map((v) => [v.id, v])) };
  }, []);
  const [newDay, setNewDay] = useState(false);
  const [dayName, setDayName] = useState('');
  if (!data) return <Loading />;
  const { program, template, variants } = data;
  if (!template) return <EmptyState title="No hay plantilla de rutina" />;

  async function addDay() {
    if (!template || !dayName.trim()) return;
    const next: RoutineTemplate = {
      ...template,
      days: [...template.days, { id: uid(), name: dayName.trim(), weekday: 3, exercises: [], timeSplit: { warmupMin: 7, strengthMin: 40, cardioMin: 10, cooldownMin: 3 } }],
    };
    await saveTemplate(next);
    if (program) await syncProgramDays(program.id, today);
    setNewDay(false);
    setDayName('');
    toast({ message: 'Día añadido. Edítalo para agregar ejercicios.', tone: 'ok' });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{template.name}</h2>
            <p className="text-sm text-muted">
              Versión {template.version} · {template.weeksTotal} semanas
            </p>
          </div>
          {program && <Pill tone="accent">Activo</Pill>}
        </div>
        {program ? (
          <>
            <p className="text-sm">
              Inicio: <strong>{formatLocalDate(program.startDate, 'long')}</strong>
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Select
                label="Semanas de adaptación (2 series por ejercicio)"
                value={String(program.adaptationWeeks)}
                onChange={(v) => setAdaptationWeeks(program.id, Number(v)).then(() => toast({ message: 'Adaptación actualizada y registrada.', tone: 'ok' }))}
                options={[0, 1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} semana${n === 1 ? '' : 's'}` }))}
              />
            </div>
            <p className="text-xs text-faint">
              Editar la plantilla crea una versión nueva y solo afecta a sesiones futuras: las ya registradas conservan su propia copia.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">No hay un programa activo. Créalo desde la configuración inicial.</p>
        )}
      </Card>

      {template.days.map((d) => (
        <Card key={d.id} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">{d.name}</h3>
            <Link to={`/rutina/dia/${d.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-surface-3 px-4">
              Editar día
            </Link>
          </div>
          {program && (
            <Select
              label="Día de la semana (desde hoy en adelante)"
              value={String(program.weekdays[d.id] ?? d.weekday)}
              onChange={(v) =>
                setProgramWeekday(program.id, d.id, Number(v), today).then(() =>
                  toast({ message: `${d.name}: ahora los ${weekdayName(Number(v))}. Solo cambian las sesiones futuras sin registro.`, tone: 'ok' }),
                )
              }
              options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: weekdayName(n) }))}
            />
          )}
          <ol className="flex flex-col gap-1 text-sm">
            {d.exercises.map((ex, i) => {
              const v = variants.get(ex.variantId);
              return (
                <li key={ex.id} className="flex flex-wrap justify-between gap-x-2 border-b border-line/50 py-1.5 last:border-0">
                  <Link to={`/biblioteca/${ex.variantId}`} className="underline-offset-2 hover:underline">
                    {i + 1}. {v?.name ?? 'Variante eliminada'}
                  </Link>
                  <span className="tabular text-muted">
                    {ex.sets} × {v?.measure === 'time' ? `${ex.durationMin ?? '?'}–${ex.durationMax ?? '?'} s` : ex.repMin === ex.repMax ? ex.repMin : `${ex.repMin}–${ex.repMax}`}
                    {ex.repsMode === 'per-side' ? ' por lado' : ''} · {ex.restSec} s
                  </span>
                  {ex.alternativeVariantIds.length > 0 && (
                    <span className="w-full text-xs text-faint">Alternativas: {ex.alternativeVariantIds.map((a) => variants.get(a)?.name ?? '—').join(', ')}</span>
                  )}
                  {ex.noDirectAlternativeNote && <span className="w-full text-xs text-warn">{ex.noDirectAlternativeNote}</span>}
                </li>
              );
            })}
          </ol>
          <p className="text-xs text-faint">
            Distribución orientativa: {d.timeSplit.warmupMin} min calentamiento · {d.timeSplit.strengthMin} fuerza · {d.timeSplit.cardioMin} cardio · {d.timeSplit.cooldownMin} cierre.
          </p>
        </Card>
      ))}
      <Button onClick={() => setNewDay(true)}>+ Añadir día a la rutina</Button>
      <Dialog
        open={newDay}
        onClose={() => setNewDay(false)}
        title="Nuevo día"
        footer={
          <Button variant="primary" disabled={!dayName.trim()} onClick={() => addDay().catch((e) => toast({ message: userMessage(e), tone: 'error' }))}>
            Crear
          </Button>
        }
      >
        <Field label="Nombre" value={dayName} onChange={(e) => setDayName(e.target.value)} placeholder="p. ej. Cuerpo completo" />
      </Dialog>
    </div>
  );
}

/* ---------- Biblioteca ---------- */

function LibraryTab() {
  const [q, setQ] = useState('');
  const [create, setCreate] = useState(false);
  const data = useLiveQuery(async () => ({ exercises: await db.exercises.toArray(), variants: await db.variants.toArray() }), []);
  const groups = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.exercises
      .filter((e) => !e.archived)
      .map((e) => ({ e, vs: data.variants.filter((v) => v.exerciseId === e.id && !v.archived && (!term || v.name.toLowerCase().includes(term) || e.name.toLowerCase().includes(term))) }))
      .filter((g) => g.vs.length > 0);
  }, [data, q]);
  if (!data) return <Loading />;
  return (
    <div className="flex flex-col gap-3">
      <Field label="Buscar ejercicio" type="search" value={q} onChange={(e) => setQ(e.target.value)} />
      <Button onClick={() => setCreate(true)}>+ Crear variante propia</Button>
      {groups.map(({ e, vs }) => (
        <Card key={e.id}>
          <h3 className="mb-2 font-semibold">{e.name}</h3>
          <ul className="flex flex-col gap-1">
            {vs.map((v) => (
              <li key={v.id}>
                <Link to={`/biblioteca/${v.id}`} className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg px-2 hover:bg-surface-2">
                  <span>{v.name}</span>
                  <span className="flex gap-1">
                    {v.custom && <Pill>Propia</Pill>}
                    {v.clipId && CLIPS.has(v.clipId) ? <Pill tone="ok">Demostración ✓</Pill> : <Pill tone="warn">Sin demostración</Pill>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {groups.length === 0 && <EmptyState title="Sin resultados" />}
      <CreateVariantDialog open={create} onClose={() => setCreate(false)} />
    </div>
  );
}

/* ---------- Equipos ---------- */

const STATUS_LABEL = { available: 'Disponible', unavailable: 'No disponible', unverified: 'Por verificar' } as const;
const KIND_LABEL: Record<EquipmentKind, string> = { machine: 'Máquina', cable: 'Polea', dumbbell: 'Mancuernas', barbell: 'Barra', smith: 'Smith', bodyweight: 'Banco / otro' };

function EquipmentTab() {
  const data = useLiveQuery(async () => ({ eq: await db.equipment.toArray(), variants: await db.variants.toArray() }), []);
  const [editing, setEditing] = useState<EquipmentInstance | null>(null);
  const [adding, setAdding] = useState(false);
  if (!data) return <Loading />;
  const vName = new Map(data.variants.map((v) => [v.id, v.name]));
  const list = data.eq.filter((e) => !e.archived).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        El inventario de tu sede no está confirmado: márcalo tú. Una nota o ajuste guardado en una máquina no se aplica a otra. Si tu sede tiene dos máquinas del mismo tipo,
        créalas por separado para no mezclar cargas.
      </p>
      <Button onClick={() => setAdding(true)}>+ Añadir equipo</Button>
      {list.map((e) => (
        <Card key={e.id} className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{e.name}</h3>
            <Pill tone={e.status === 'available' ? 'ok' : e.status === 'unavailable' ? 'danger' : 'warn'}>
              {e.status === 'available' ? '✓' : e.status === 'unavailable' ? '✕' : '?'} {STATUS_LABEL[e.status]}
            </Pill>
          </div>
          <p className="text-sm text-muted">
            {KIND_LABEL[e.kind]} · unidad {e.unit} · incremento mínimo {e.minIncrement === null ? 'sin definir' : `${e.minIncrement} ${e.unit}`}
            {e.declaredBaseResistance !== null ? ` · resistencia base declarada ${e.declaredBaseResistance} ${e.unit}` : ''}
            {e.location ? ` · ${e.location}` : ''}
          </p>
          <p className="text-xs text-faint">Para: {e.variantIds.map((id) => vName.get(id) ?? id).join(', ')}</p>
          <div>
            <Button size="sm" onClick={() => setEditing(e)}>
              Editar
            </Button>
          </div>
        </Card>
      ))}
      <EquipmentDialog key={editing?.id ?? (adding ? 'new' : 'none')} open={!!editing || adding} initial={editing} variants={data.variants} onClose={() => { setEditing(null); setAdding(false); }} />
    </div>
  );
}

function EquipmentDialog({ open, initial, onClose, variants }: { open: boolean; initial: EquipmentInstance | null; onClose: () => void; variants: ExerciseVariant[] }) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<EquipmentKind>(initial?.kind ?? 'machine');
  const [status, setStatus] = useState(initial?.status ?? 'unverified');
  const [unit, setUnit] = useState<LoadUnit>(initial?.unit ?? 'kg');
  const [inc, setInc] = useState(initial?.minIncrement?.toString().replace('.', ',') ?? '');
  const [base, setBase] = useState(initial?.declaredBaseResistance?.toString().replace('.', ',') ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [vids, setVids] = useState<string[]>(initial?.variantIds ?? []);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    const i = parseDecimal(inc, 'El incremento');
    const b = parseDecimal(base, 'La resistencia base');
    if (!i.ok || !b.ok) return setErr(!i.ok ? i.error : !b.ok ? b.error : null);
    if (!name.trim()) return setErr('Ponle un nombre.');
    const now = nowIso();
    const rec: EquipmentInstance = {
      id: initial?.id ?? uid(),
      name: name.trim(),
      kind,
      variantIds: vids,
      status,
      unit,
      minIncrement: i.value,
      declaredBaseResistance: b.value,
      location,
      archived: false,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await db.equipment.put(rec);
      toast({ message: 'Equipo guardado.', tone: 'ok' });
      onClose();
    } catch (e) {
      setErr(userMessage(e));
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Editar equipo' : 'Nuevo equipo'}
      footer={
        <>
          {initial && (
            <Button variant="ghost" onClick={() => db.equipment.update(initial.id, { archived: true, updatedAt: nowIso() }).then(onClose)}>
              Archivar
            </Button>
          )}
          <Button variant="primary" onClick={save}>
            Guardar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Select label="Tipo" value={kind} onChange={(v) => setKind(v as EquipmentKind)} options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))} />
          <Select label="Estado en tu sede" value={status} onChange={(v) => setStatus(v as EquipmentInstance['status'])} options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
          <Select label="Unidad de la pila/discos" value={unit} onChange={(v) => setUnit(v as LoadUnit)} options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]} />
          <Field label="Incremento mínimo" inputMode="decimal" value={inc} onChange={(e) => setInc(e.target.value)} suffix={unit} />
        </div>
        <Field
          label="Resistencia base declarada (opcional)"
          inputMode="decimal"
          value={base}
          onChange={(e) => setBase(e.target.value)}
          suffix={unit}
          hint="Solo si el fabricante o el gimnasio la indica (p. ej. barra Smith). No se asume ningún valor."
        />
        <Field label="Ubicación o identificación" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="p. ej. junto a la ventana" />
        <fieldset className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-line p-2">
          <legend className="px-1 text-sm text-muted">Variantes que se hacen en este equipo</legend>
          {variants.map((v) => (
            <label key={v.id} className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={vids.includes(v.id)} onChange={(e) => setVids((x) => (e.target.checked ? [...x, v.id] : x.filter((y) => y !== v.id)))} />
              {v.name} <span className="text-faint">({loadLabel(v.loadConvention, v.implements)})</span>
            </label>
          ))}
        </fieldset>
        {err && (
          <p className="text-sm text-danger" role="alert">
            {err}
          </p>
        )}
      </div>
    </Dialog>
  );
}
