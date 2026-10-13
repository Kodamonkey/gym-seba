import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ExerciseVariant, SessionExercise, SetLog, WorkoutSession } from '../../domain/types';
import { adviseProgression } from '../../domain/progression';
import { db, userMessage } from '../../data/db';
import { addSet, deleteSet, restoreSet, substituteVariant } from '../../data/sessions';
import { CheckIcon, ChevronLeftIcon, InfoIcon, MinusIcon, MoreIcon, PlusIcon, SwapIcon } from '../../ui/icons';
import { Dialog, IconButton } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { loadColumn, reachedTop, setText, targetText } from '../shared';
import { suggestionsFor, type Suggestion } from './logic';
import { SetRow } from './SetRow';

interface Props {
  session: WorkoutSession;
  se: SessionExercise;
  sets: SetLog[];
  canEdit: boolean;
  onTechnique: (variantId: string) => void;
}

/** Un ejercicio de la sesión: objetivo, lo de la última vez y sus series. */
export function ExerciseBlock({ session, se, sets, canEdit, onTechnique }: Props) {
  const suggestionContext = JSON.stringify([se.id, se.variantId, se.equipmentInstanceId, se.rev, se.unit]);
  const [cachedSuggestions, setCachedSuggestions] = useState<{
    context: string;
    value: Awaited<ReturnType<typeof suggestionsFor>>;
  } | null>(null);
  // Una consulta pendiente de otra variante, máquina o revisión nunca alimenta las nuevas series.
  const sugg = cachedSuggestions?.context === suggestionContext ? cachedSuggestions.value : null;
  const [menu, setMenu] = useState<'options' | 'alternatives' | null>(null);

  useEffect(() => {
    let alive = true;
    suggestionsFor(se).then((value) => alive && setCachedSuggestions({ context: suggestionContext, value }));
    return () => {
      alive = false;
    };
  }, [suggestionContext]);

  const live = useMemo(() => sets.filter((s) => s.deletedAt === null).sort((a, b) => a.order - b.order), [sets]);
  const perSideRows = se.variant.laterality === 'unilateral' && se.unilateralLogging === 'per-side-rows';
  const expected = se.prescribed.sets * (perSideRows ? 2 : 1);
  const doneWork = live.filter((s) => s.kind === 'work' && s.status === 'completed').length;
  const complete = doneWork >= expected;

  // Número de cada serie de trabajo (los calentamientos antiguos se marcan con "C").
  const labels = useMemo(() => {
    const m = new Map<string, { label: string; workIndex: number | null }>();
    let n = 0;
    let workRow = 0;
    for (const s of live) {
      if (s.kind !== 'work') m.set(s.id, { label: 'C', workIndex: null });
      else {
        const shared = perSideRows && s.side === 'right' && n > 0;
        if (!shared) n++;
        m.set(s.id, { label: String(n), workIndex: perSideRows ? workRow : n - 1 });
        workRow++;
      }
    }
    return m;
  }, [live, perSideRows]);

  const prevWork = sugg?.prev?.sets.filter((s) => s.kind === 'work') ?? [];
  const isTime = se.variant.measure === 'time';
  const showTop = !isTime && reachedTop(prevWork, se.prescribed.repMax);
  const previous = sugg?.prev;
  const advice = showTop && previous?.confirmed && prevWork.every((s) => s.unit === se.unit) ? adviseProgression({
    prescribed: { ...se.prescribed, sets: Math.max(se.prescribed.sets, previous.sessionExercise.prescribed.sets) },
    measure: se.variant.measure,
    workSets: prevWork,
    perSideRows,
    techniqueConfirmed: previous.sessionExercise.techniqueConfirmed,
    painReported: previous.sessionExercise.painReported,
    sessionComplete: previous.session.status === 'completed',
    minIncrement: null,
    unit: se.unit,
  }) : null;

  return (
    <section className="mt-3 rounded-2xl border border-line bg-surface p-4" aria-labelledby={`ex-${se.id}`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={`ex-${se.id}`} className="flex items-center gap-2 text-[17px] font-semibold leading-snug">
            {complete && (
              <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-ok text-white" aria-label="Completo">
                <CheckIcon size={12} strokeWidth={3.5} />
              </span>
            )}
            <span>{se.variant.name}</span>
          </h2>
          <p className="mt-0.5 text-[13px] text-muted tabular">
            {targetText(se.prescribed, se.variant.measure)} · descanso {se.prescribed.restSec} s · RIR {se.prescribed.rirMin}–{se.prescribed.rirMax}
          </p>
        </div>
        <IconButton label={`Opciones de ${se.variant.name}`} onClick={() => setMenu('options')} className="-mr-2 -mt-2 text-muted">
          <MoreIcon size={22} />
        </IconButton>
      </div>

      {prevWork.length > 0 && <p className="mt-2 text-[13px] text-muted tabular">Última vez: {prevWork.map((s) => setText(s, s.unit)).join(' · ')}{previous && !previous.confirmed ? ' · misma máquina por confirmar' : ''}</p>}
      {advice && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-muted">{advice.kind === 'needs-confirmation' ? 'Faltan datos para sugerir subir carga. Comprueba la técnica y el RIR con un entrenador antes de considerar un aumento.' : advice.message}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-x-5">
        <button type="button" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent" onClick={() => onTechnique(se.variantId)} aria-label={`Ver técnica de ${se.variant.name}`}>
          <InfoIcon size={17} /> Ver técnica
        </button>
        <button type="button" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent disabled:opacity-40" onClick={() => setMenu('alternatives')} disabled={!canEdit} aria-label={`Cambiar ${se.variant.name}`}>
          <SwapIcon size={17} /> Cambiar
        </button>
      </div>

      <div className="mt-3 grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 pr-1 text-center text-[11px] font-semibold uppercase tracking-wider text-faint" aria-hidden>
        <span>Serie</span>
        <span>{se.variant.loadConvention === 'none' ? '' : loadColumn(se.variant, se.unit)}</span>
        <span>{isTime ? (se.prescribed.repsMode === 'per-side' ? 'Seg/lado' : 'Seg') : se.prescribed.repsMode === 'per-side' ? 'Reps/lado' : 'Reps'}</span>
        <span />
      </div>
      <ol className="mt-1 flex flex-col gap-1" aria-label={`Series de ${se.variant.name}`}>
        {live.map((s, i) => {
          const l = labels.get(s.id);
          return (
            <SetRow
              key={s.id}
              set={s}
              se={se}
              label={l?.label ?? '–'}
              suggestion={l?.workIndex != null ? (sugg?.byOrder.get(l.workIndex) ?? fromPreviousRow(live, i)) : undefined}
              canEdit={canEdit}
            />
          );
        })}
      </ol>

      <ExerciseMenu
        open={menu !== null}
        swapping={menu === 'alternatives'}
        onSwap={() => setMenu('alternatives')}
        onBack={() => setMenu('options')}
        onClose={() => setMenu(null)}
        session={session}
        se={se}
        live={live}
        canEdit={canEdit}
        onTechnique={() => {
          setMenu(null);
          onTechnique(se.variantId);
        }}
      />
    </section>
  );
}

/** Sin historial, la serie propone lo de la serie hecha justo antes en esta sesión. */
function fromPreviousRow(live: SetLog[], index: number): Suggestion | undefined {
  const side = live[index]?.side;
  for (let i = index - 1; i >= 0; i--) {
    const s = live[i]!;
    if (s.kind === 'work' && s.status === 'completed' && (side == null || s.side === side)) return { load: s.load, reps: s.reps, durationSec: s.durationSec, source: 'previous', fromDate: '' };
  }
  return undefined;
}

function MenuItem({ icon, children, onClick, disabled }: { icon: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <li>
      <button type="button" onClick={onClick} disabled={disabled} className="flex min-h-14 w-full items-center gap-4 rounded-xl px-1 text-left text-[16px] active:bg-surface-2 disabled:opacity-40">
        <span className="text-muted">{icon}</span>
        {children}
      </button>
    </li>
  );
}

function ExerciseMenu({
  open,
  swapping,
  onSwap,
  onBack,
  onClose,
  session,
  se,
  live,
  canEdit,
  onTechnique,
}: {
  open: boolean;
  swapping: boolean;
  onSwap: () => void;
  onBack: () => void;
  onClose: () => void;
  session: WorkoutSession;
  se: SessionExercise;
  live: SetLog[];
  canEdit: boolean;
  onTechnique: () => void;
}) {
  const toast = useToast();
  const last = live[live.length - 1];
  const canRemove = !!last && last.status === 'draft' && live.length > 1;

  const alternatives = useLiveQuery(async () => {
    if (!open) return null;
    const program = session.programId ? await db.programs.get(session.programId) : undefined;
    const template = program ? await db.routineTemplates.get(program.templateId) : undefined;
    const slot = template?.days.find((d) => d.id === session.dayId)?.exercises.find((e) => e.id === se.slotId);
    const variant = await db.variants.get(se.variantId);
    const sameExercise = variant ? await db.variants.where('exerciseId').equals(variant.exerciseId).toArray() : [];
    const ids = new Set([...(slot?.alternativeVariantIds ?? []), ...sameExercise.map((v) => v.id), ...(se.substitutedFromVariantId ? [se.substitutedFromVariantId] : [])]);
    ids.delete(se.variantId);
    const variants = (await db.variants.bulkGet([...ids])).filter((v): v is ExerciseVariant => !!v && !v.archived);
    const otherMovement = variants.some((v) => v.exerciseId !== se.variant.exerciseId);
    return {
      variants,
      note: slot?.noDirectAlternativeNote || (otherMovement ? slot?.notes : undefined),
    };
  }, [open, session.id, se.slotId, se.variantId]);

  const close = () => {
    onClose();
  };
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      toast({ message: userMessage(e), tone: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={close} title={swapping ? 'Cambiar por' : se.variant.name}>
      {swapping ? (
        <>
          <p className="mb-2 text-sm text-muted">Si falta la máquina o está ocupada, elige otra opción. Confirma el equipo en tu sede.</p>
          {alternatives?.note && <p className="mb-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{alternatives.note}</p>}
          <ul className="flex flex-col">
            <MenuItem icon={<ChevronLeftIcon />} onClick={onBack}>
              Volver
            </MenuItem>
            {alternatives?.variants.map((v) => (
              <MenuItem
                key={v.id}
                icon={<SwapIcon />}
                disabled={!canEdit}
                onClick={() =>
                  run(async () => {
                    await substituteVariant(se.id, v.id);
                    toast({ message: `Cambiado a ${v.name}.` });
                    close();
                  })
                }
              >
                <span className="min-w-0 flex-1 py-2">
                  <span className="block font-medium leading-snug">{v.name}</span>
                  <span className="mt-1 block text-xs text-muted">
                    {EQUIPMENT_LABELS[v.equipmentKind]} · {v.exerciseId === se.variant.exerciseId ? 'Mismo ejercicio' : 'Otro movimiento'}
                  </span>
                </span>
              </MenuItem>
            ))}
            {alternatives && alternatives.variants.length === 0 && <li className="py-3 text-sm text-muted">No hay alternativas para este ejercicio.</li>}
          </ul>
        </>
      ) : (
        <ul className="flex flex-col">
          <MenuItem icon={<InfoIcon />} onClick={onTechnique}>
            Ver técnica
          </MenuItem>
          <MenuItem icon={<PlusIcon />} disabled={!canEdit} onClick={() => run(() => addSet(se.id, 'work').then(close))}>
            Añadir serie
          </MenuItem>
          <MenuItem
            icon={<MinusIcon />}
            disabled={!canEdit || !canRemove}
            onClick={() =>
              run(async () => {
                await deleteSet(last!.id);
                close();
                toast({ message: 'Serie quitada.', action: { label: 'Deshacer', run: () => void restoreSet(last!.id) } });
              })
            }
          >
            Quitar última serie
          </MenuItem>
          <MenuItem icon={<SwapIcon />} disabled={!canEdit} onClick={onSwap}>
            Cambiar ejercicio
          </MenuItem>
        </ul>
      )}
      {swapping && <p className="mt-2 text-xs text-muted">Las series realizadas se conservan. La nueva variante empieza con carga vacía.</p>}
    </Dialog>
  );
}

const EQUIPMENT_LABELS: Record<ExerciseVariant['equipmentKind'], string> = {
  machine: 'Máquina',
  cable: 'Polea',
  dumbbell: 'Mancuernas',
  barbell: 'Barra y discos',
  smith: 'Smith',
  bodyweight: 'Peso corporal',
};
