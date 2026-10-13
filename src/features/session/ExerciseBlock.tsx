import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ExerciseVariant, SessionExercise, SetLog, WorkoutSession } from '../../domain/types';
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
  const [sugg, setSugg] = useState<Awaited<ReturnType<typeof suggestionsFor>> | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    let alive = true;
    suggestionsFor(se).then((r) => alive && setSugg(r));
    return () => {
      alive = false;
    };
  }, [se.id, se.variantId, se.equipmentInstanceId, se.rev]);

  const live = useMemo(() => sets.filter((s) => s.deletedAt === null).sort((a, b) => a.order - b.order), [sets]);
  const perSideRows = se.variant.laterality === 'unilateral' && se.unilateralLogging === 'per-side-rows';
  const expected = se.prescribed.sets * (perSideRows ? 2 : 1);
  const doneWork = live.filter((s) => s.kind === 'work' && s.status === 'completed').length;
  const complete = doneWork >= expected;

  // Número de cada serie de trabajo (los calentamientos antiguos se marcan con "C").
  const labels = useMemo(() => {
    const m = new Map<string, { label: string; workIndex: number | null }>();
    let n = 0;
    for (const s of live) {
      if (s.kind !== 'work') m.set(s.id, { label: 'C', workIndex: null });
      else {
        const shared = perSideRows && s.side === 'right' && n > 0;
        if (!shared) n++;
        m.set(s.id, { label: String(n), workIndex: n - 1 });
      }
    }
    return m;
  }, [live, perSideRows]);

  const prevWork = sugg?.prev?.sets.filter((s) => s.kind === 'work') ?? [];
  const isTime = se.variant.measure === 'time';
  const showTop = !isTime && reachedTop(prevWork, se.prescribed.repMax);

  return (
    <section className="border-b border-line py-5 last:border-b-0" aria-labelledby={`ex-${se.id}`}>
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
            {targetText(se.prescribed, se.variant.measure)} · descanso {se.prescribed.restSec} s
          </p>
        </div>
        <IconButton label={`Opciones de ${se.variant.name}`} onClick={() => setMenu(true)} className="-mr-2 -mt-2 text-muted">
          <MoreIcon size={22} />
        </IconButton>
      </div>

      {prevWork.length > 0 && <p className="mt-2 text-[13px] text-muted tabular">Última vez: {prevWork.map(setText).join(' · ')}</p>}
      {showTop && <p className="mt-1 text-[13px] font-medium text-ok">Llegaste al tope de repeticiones: prueba subir un poco el peso.</p>}

      <div className="mt-3 grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 pr-1 text-center text-[11px] font-semibold uppercase tracking-wider text-faint" aria-hidden>
        <span>Serie</span>
        <span>{se.variant.loadConvention === 'none' ? '' : loadColumn(se.variant, se.unit)}</span>
        <span>{isTime ? 'Seg' : se.prescribed.repsMode === 'per-side' ? 'Reps/lado' : 'Reps'}</span>
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
        open={menu}
        onClose={() => setMenu(false)}
        session={session}
        se={se}
        live={live}
        canEdit={canEdit}
        onTechnique={() => {
          setMenu(false);
          onTechnique(se.variantId);
        }}
      />
    </section>
  );
}

/** Sin historial, la serie propone lo de la serie hecha justo antes en esta sesión. */
function fromPreviousRow(live: SetLog[], index: number): Suggestion | undefined {
  for (let i = index - 1; i >= 0; i--) {
    const s = live[i]!;
    if (s.kind === 'work' && s.status === 'completed') return { load: s.load, reps: s.reps, durationSec: s.durationSec, source: 'previous', fromDate: '' };
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
  onClose,
  session,
  se,
  live,
  canEdit,
  onTechnique,
}: {
  open: boolean;
  onClose: () => void;
  session: WorkoutSession;
  se: SessionExercise;
  live: SetLog[];
  canEdit: boolean;
  onTechnique: () => void;
}) {
  const toast = useToast();
  const [swapping, setSwapping] = useState(false);
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
    return (await db.variants.bulkGet([...ids])).filter((v): v is ExerciseVariant => !!v && !v.archived);
  }, [open, session.id, se.slotId, se.variantId]);

  const close = () => {
    setSwapping(false);
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
        <ul className="flex flex-col">
          <MenuItem icon={<ChevronLeftIcon />} onClick={() => setSwapping(false)}>
            Volver
          </MenuItem>
          {alternatives?.map((v) => (
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
              {v.name}
            </MenuItem>
          ))}
          {alternatives && alternatives.length === 0 && <li className="py-3 text-sm text-muted">No hay alternativas para este ejercicio.</li>}
        </ul>
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
          <MenuItem icon={<SwapIcon />} disabled={!canEdit} onClick={() => setSwapping(true)}>
            Cambiar ejercicio
          </MenuItem>
        </ul>
      )}
      {swapping && <p className="mt-2 text-xs text-muted">Las cargas no se traspasan entre ejercicios distintos.</p>}
    </Dialog>
  );
}
