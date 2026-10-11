import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useActiveSession, useTimeZone, useToday } from '../../app/hooks';
import { addDays, addMonths, formatLocalDate, isoWeekday, monthGrid, monthName, parseLocalDate, startOfMonth, startOfWeek, weekdayName } from '../../domain/dates';
import { PLAN_STATUS_LABEL, PLAN_STATUS_SYMBOL, type PlanStatus } from '../../domain/schedule';
import type { LocalDate, WorkoutSession } from '../../domain/types';
import { describeStorageError } from '../../data/db';
import { addManualWorkout, changeRecurrence, deleteScheduledWorkout, setSkipped, startScheduledWorkout } from '../../data/program';
import { ActiveSessionExistsError } from '../../data/sessions';
import { Button, Card, Dialog, EmptyState, Field, Loading, Select } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { usePlan, type PlannedItem } from '../plan';

type View = 'month' | 'week' | 'agenda';

const STATUS_CLASS: Record<PlanStatus, string> = {
  planned: 'border-line bg-surface-2',
  'in-progress': 'border-info bg-info/15',
  completed: 'border-ok bg-ok/15',
  partial: 'border-warn bg-warn/15',
  skipped: 'border-danger/60 bg-danger/10 line-through',
  unclassified: 'border-warn border-dashed bg-transparent',
};

function readView(): View {
  try {
    const v = localStorage.getItem('atlas:calendar-view');
    return v === 'week' || v === 'agenda' ? v : 'month';
  } catch {
    return 'month';
  }
}

export function CalendarPage() {
  const today = useToday();
  const tz = useTimeZone();
  const plan = usePlan(today);
  const active = useActiveSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [view, setViewState] = useState<View>(readView);
  const [anchor, setAnchor] = useState<LocalDate>(today);
  const [selected, setSelected] = useState<PlannedItem | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ item: PlannedItem; date: LocalDate } | null>(null);
  const [adding, setAdding] = useState<LocalDate | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem('atlas:calendar-view', v);
    } catch {
      // Preferencia de vista no persistida; no afecta a los datos.
    }
  };

  if (!plan) return <Loading />;
  const byDate = new Map<LocalDate, PlannedItem[]>();
  for (const it of plan.items) byDate.set(it.sw.date, [...(byDate.get(it.sw.date) ?? []), it]);
  const linked = new Set(plan.items.map((i) => i.sw.sessionId).filter(Boolean));
  const free = new Map<LocalDate, WorkoutSession[]>();
  for (const s of plan.sessions) if (!linked.has(s.id) && s.status !== 'discarded') free.set(s.localDate, [...(free.get(s.localDate) ?? []), s]);

  function requestMove(item: PlannedItem, date: LocalDate) {
    if (item.session) {
      toast({ message: 'Esta sesión ya tiene registro: no se puede mover.', tone: 'error' });
      return;
    }
    if (date === item.sw.date) return;
    setMoveTarget({ item, date });
  }

  async function doMove(scope: 'only-this' | 'this-and-future') {
    if (!moveTarget) return;
    try {
      await changeRecurrence(moveTarget.item.sw.id, moveTarget.date, scope);
      toast({ message: scope === 'only-this' ? `Movida al ${formatLocalDate(moveTarget.date)}.` : 'Recurrencia actualizada para esta y las futuras sin registro.', tone: 'ok' });
      setMoveTarget(null);
      setSelected(null);
    } catch (e) {
      toast({ message: e instanceof Error ? e.message : describeStorageError(e), tone: 'error' });
    }
  }

  const chip = (it: PlannedItem, compact = false) => (
    <button
      key={it.sw.id}
      type="button"
      draggable={!it.session}
      onDragStart={(e) => {
        setDragId(it.sw.id);
        e.dataTransfer.setData('text/plain', it.sw.id);
      }}
      onDragEnd={() => setDragId(null)}
      onClick={() => setSelected(it)}
      className={`w-full truncate rounded-md border px-0.5 py-0.5 text-left text-[11px] leading-tight ${STATUS_CLASS[it.status]} ${dragId === it.sw.id ? 'opacity-50' : ''}`}
      aria-label={`${it.day?.name ?? 'Sesión'}, ${PLAN_STATUS_LABEL[it.status]}, ${formatLocalDate(it.sw.date)}. Abrir opciones`}
    >
      <span aria-hidden>{PLAN_STATUS_SYMBOL[it.status]} </span>
      {compact ? shortName(it.day?.name ?? '—') : (it.day?.name ?? '—')}
      {!compact && <span className="text-muted"> · {PLAN_STATUS_LABEL[it.status]}</span>}
    </button>
  );

  const dropProps = (date: LocalDate) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const idDrop = e.dataTransfer.getData('text/plain');
      const it = plan.items.find((x) => x.sw.id === idDrop);
      if (it) requestMove(it, date);
    },
  });

  const freeChips = (date: LocalDate) =>
    (free.get(date) ?? []).map((s) => (
      <Link key={s.id} to={s.status === 'active' ? '/sesion' : `/historial/${s.id}`} className="block truncate rounded-md border border-line bg-surface px-1 py-0.5 text-[11px]">
        {s.status === 'active' ? '◐' : s.status === 'completed' ? '●' : '◑'} Libre: {s.title}
      </Link>
    ));

  const { y, m } = parseLocalDate(anchor);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Calendario</h1>
        <div role="group" aria-label="Vista" className="flex gap-1 rounded-xl bg-surface p-1">
          {(
            [
              ['month', 'Mes'],
              ['week', 'Semana'],
              ['agenda', 'Agenda'],
            ] as const
          ).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-10 rounded-lg px-3 text-sm ${view === v ? 'bg-surface-3 font-semibold' : 'text-muted'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {!plan.program && <EmptyState title="No hay programa activo" />}

      {view !== 'agenda' && (
        <div className="flex items-center justify-between gap-2">
          <Button size="sm" onClick={() => setAnchor(view === 'month' ? addMonths(anchor, -1) : addDays(anchor, -7))} aria-label="Anterior">
            ←
          </Button>
          <p className="font-semibold capitalize">
            {view === 'month' ? `${monthName(m)} ${y}` : `Semana del ${formatLocalDate(startOfWeek(anchor))}`}
          </p>
          <div className="flex gap-1">
            <Button size="sm" onClick={() => setAnchor(today)}>
              Hoy
            </Button>
            <Button size="sm" onClick={() => setAnchor(view === 'month' ? addMonths(anchor, 1) : addDays(anchor, 7))} aria-label="Siguiente">
              →
            </Button>
          </div>
        </div>
      )}

      {view === 'month' && (
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="grid grid-cols-7 bg-surface text-center text-xs text-muted">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className="py-1">
                {weekdayName(d, true)}
              </div>
            ))}
          </div>
          {monthGrid(startOfMonth(anchor)).map((week) => (
            <div key={week[0]} className="grid grid-cols-7 border-t border-line">
              {week.map((d) => {
                const inMonth = parseLocalDate(d).m === m;
                const items = byDate.get(d) ?? [];
                return (
                  <div key={d} {...dropProps(d)} className={`min-h-20 border-l border-line p-1 first:border-l-0 ${inMonth ? '' : 'opacity-40'} ${d === today ? 'bg-accent/5' : ''}`}>
                    <button type="button" className={`mb-0.5 text-xs ${d === today ? 'font-bold text-accent' : 'text-muted'}`} onClick={() => setAdding(d)} aria-label={`Añadir sesión el ${formatLocalDate(d)}`}>
                      {parseLocalDate(d).d}
                    </button>
                    <div className="flex flex-col gap-0.5">
                      {items.map((it) => chip(it, true))}
                      {freeChips(d)}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {view === 'week' && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 7 }, (_, k) => addDays(startOfWeek(anchor), k)).map((d) => {
            const items = byDate.get(d) ?? [];
            return (
              <Card key={d} {...dropProps(d)} className={`flex flex-col gap-1 ${d === today ? 'border-accent' : ''}`}>
                <div className="flex items-center justify-between">
                  <p className="font-medium capitalize">{formatLocalDate(d)}</p>
                  <Button size="sm" variant="ghost" onClick={() => setAdding(d)}>
                    + Añadir
                  </Button>
                </div>
                {items.length === 0 && (free.get(d) ?? []).length === 0 && (
                  <p className="text-sm text-faint">
                    <span aria-hidden>{PLAN_STATUS_SYMBOL.rest} </span>
                    {PLAN_STATUS_LABEL.rest}
                  </p>
                )}
                {items.map((it) => chip(it))}
                {freeChips(d)}
              </Card>
            );
          })}
        </div>
      )}

      {view === 'agenda' && (
        <ol className="flex flex-col gap-2">
          {plan.items.map((it) => (
            <li key={it.sw.id} className="flex items-center gap-3">
              <span className={`w-28 flex-none text-sm capitalize ${it.sw.date === today ? 'font-bold text-accent' : 'text-muted'}`}>{formatLocalDate(it.sw.date, 'compact')}</span>
              <div className="flex-1">{chip(it)}</div>
            </li>
          ))}
        </ol>
      )}

      <p className="text-xs text-faint">
        ● completada · ◑ parcial · ◐ en curso · ○ planificada · ? sin registrar · ✕ omitida · – descanso. Arrastra una sesión a otro día o ábrela y usa "Mover a…".
      </p>

      <Dialog open={!!selected} onClose={() => setSelected(null)} title={selected?.day?.name ?? 'Sesión'}>
        {selected && (
          <div className="flex flex-col gap-3">
            <p>
              {formatLocalDate(selected.sw.date, 'long')} · <strong>{PLAN_STATUS_LABEL[selected.status]}</strong>
              {selected.sw.movedFrom && <span className="block text-sm text-muted">Reprogramada desde el {formatLocalDate(selected.sw.movedFrom)}.</span>}
            </p>
            {selected.session ? (
              <Link to={selected.status === 'in-progress' ? '/sesion' : `/historial/${selected.session.id}`} className="text-accent underline">
                {selected.status === 'in-progress' ? 'Ir a la sesión en curso' : 'Ver registro'}
              </Link>
            ) : (
              <>
                {!active && selected.day && (
                  <Button
                    variant="primary"
                    onClick={async () => {
                      try {
                        await startScheduledWorkout(selected.sw.id, tz);
                        navigate('/sesion');
                      } catch (e) {
                        toast({ message: e instanceof ActiveSessionExistsError ? e.message : describeStorageError(e), tone: 'error' });
                      }
                    }}
                  >
                    Iniciar ahora
                  </Button>
                )}
                <MoveForm item={selected} onMove={(date) => requestMove(selected, date)} />
                <Button onClick={() => setSkipped(selected.sw.id, !selected.sw.skippedConfirmed).then(() => setSelected(null))}>
                  {selected.sw.skippedConfirmed ? 'Quitar marca de omitida' : 'Marcar como omitida'}
                </Button>
                {selected.sw.origin === 'manual' && (
                  <Button variant="ghost" onClick={() => deleteScheduledWorkout(selected.sw.id).then(() => setSelected(null))}>
                    Eliminar sesión añadida
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!moveTarget}
        onClose={() => setMoveTarget(null)}
        title="Mover sesión"
        footer={
          <>
            <Button onClick={() => doMove('only-this')}>Solo esta sesión</Button>
            {moveTarget?.item.sw.origin === 'rule' && (
              <Button variant="primary" onClick={() => doMove('this-and-future')}>
                Esta y las futuras
              </Button>
            )}
          </>
        }
      >
        {moveTarget && (
          <p className="text-sm">
            Mover <strong>{moveTarget.item.day?.name}</strong> del {formatLocalDate(moveTarget.item.sw.date)} al <strong>{formatLocalDate(moveTarget.date)}</strong> ({weekdayName(isoWeekday(moveTarget.date))}).
            "Esta y las futuras" cambia el día de la semana de las próximas sesiones sin registro; nunca modifica sesiones realizadas ni duplica volumen.
          </p>
        )}
      </Dialog>

      <AddDialog
        date={adding}
        onClose={() => setAdding(null)}
        days={plan.template?.days.map((d) => ({ value: d.id, label: d.name })) ?? []}
        onAdd={async (dayId) => {
          if (!plan.program || !adding) return;
          await addManualWorkout(plan.program.id, dayId, adding);
          toast({ message: `Sesión añadida el ${formatLocalDate(adding)}.`, tone: 'ok' });
          setAdding(null);
        }}
      />
    </div>
  );
}

/** Nombre corto para celdas pequeñas: "Tren superior A" → "SupA". */
function shortName(name: string): string {
  const words = name.split(/\s+/).filter((w) => w.toLowerCase() !== 'tren');
  return words.map((w) => (w.length > 3 ? w.slice(0, 3) : w)).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}

function MoveForm({ item, onMove }: { item: PlannedItem; onMove: (d: LocalDate) => void }) {
  const [date, setDate] = useState(item.sw.date);
  return (
    <div className="flex items-end gap-2">
      <Field label="Mover a…" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="flex-1" />
      <Button onClick={() => onMove(date)} disabled={!date || date === item.sw.date}>
        Mover
      </Button>
    </div>
  );
}

function AddDialog({ date, onClose, days, onAdd }: { date: LocalDate | null; onClose: () => void; days: { value: string; label: string }[]; onAdd: (dayId: string) => Promise<void> }) {
  const [dayId, setDayId] = useState('');
  return (
    <Dialog open={!!date} onClose={onClose} title={date ? `Añadir sesión · ${formatLocalDate(date)}` : 'Añadir sesión'} footer={<Button variant="primary" disabled={!dayId} onClick={() => onAdd(dayId)}>Añadir</Button>}>
      <Select label="Día de la rutina" value={dayId} onChange={setDayId} options={[{ value: '', label: 'Elige…' }, ...days]} />
      <p className="mt-2 text-xs text-faint">Se añade solo esta sesión; no se compensa volumen de otros días.</p>
    </Dialog>
  );
}
