import { useEffect, useRef, useState } from 'react';
import { loadLabel } from '../../domain/load';
import type { SessionExercise, SetLog } from '../../domain/types';
import { checkSetForConfirm, formatDecimal, parseDuration, parseLoad, parseReps, parseRir } from '../../domain/validation';
import { ConflictError, describeStorageError } from '../../data/db';
import { addSet, deleteSet, moveSet, restoreSet, uncompleteSet, updateSet } from '../../data/sessions';
import { startRestTimer } from '../../data/timers';
import { usePrefs } from '../../app/hooks';
import { Button, Dialog } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { PR_LABEL } from '../../domain/pr';
import { confirmWithRecords, restAfter, type Suggestion } from './logic';

interface Props {
  set: SetLog;
  index: number;
  se: SessionExercise;
  suggestion?: Suggestion | undefined;
  canEdit: boolean;
  workNumber: number | null;
  /** Corrección de una sesión pasada: sin descanso ni celebración. */
  historical?: boolean;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const durationText = (s: number | null) => (s === null ? '' : s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s));

/**
 * Fila de serie. Los valores sugeridos aparecen como marcador (no cuentan).
 * Los borradores se guardan al salir del campo; "Guardado" se muestra solo tras escribir.
 */
export function SetRow({ set, se, suggestion, canEdit, workNumber, historical }: Props) {
  const toast = useToast();
  const prefs = usePrefs();
  const [load, setLoad] = useState(formatDecimal(set.load));
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [dur, setDur] = useState(durationText(set.durationSec));
  const [rir, setRir] = useState(formatDecimal(set.rir));
  const [err, setErr] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>('idle');
  const [editing, setEditing] = useState(false);
  const [menu, setMenu] = useState(false);
  const [warn, setWarn] = useState<string[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const busy = useRef(false);
  // Última revisión conocida y guardado de borrador en curso: evita conflictos falsos
  // cuando el usuario sale del campo y toca "confirmar" en el mismo gesto.
  const revRef = useRef(set.rev);
  const pending = useRef<Promise<unknown> | null>(null);
  useEffect(() => {
    revRef.current = Math.max(revRef.current, set.rev);
  }, [set.rev]);
  const isTime = se.variant.measure === 'time';
  const done = set.status === 'completed';
  const locked = !canEdit || (done && !editing);

  // Sincroniza con cambios externos (otra pestaña, deshacer) cuando no se está editando.
  const focused = useRef(false);
  useEffect(() => {
    if (focused.current) return;
    setLoad(formatDecimal(set.load));
    setReps(set.reps?.toString() ?? '');
    setDur(durationText(set.durationSec));
    setRir(formatDecimal(set.rir));
  }, [set.load, set.reps, set.durationSec, set.rir, set.rev]);

  function parsed() {
    const l = parseLoad(load);
    const r = isTime ? { ok: true as const, value: null } : parseReps(reps);
    const d = isTime ? parseDuration(dur) : { ok: true as const, value: null };
    const q = parseRir(rir);
    const firstErr = [l, r, d, q].find((x) => !x.ok) as { ok: false; error: string } | undefined;
    if (firstErr) return { error: firstErr.error } as const;
    return {
      values: {
        load: l.ok ? l.value : null,
        reps: r.ok ? r.value : null,
        durationSec: d.ok ? d.value : null,
        rir: q.ok ? q.value : null,
      },
    } as const;
  }

  async function saveDraft() {
    focused.current = false;
    if (!canEdit || (done && !editing)) return;
    const p = parsed();
    if ('error' in p) {
      setErr(p.error ?? null);
      return;
    }
    setErr(null);
    const v = p.values;
    if (v.load === set.load && v.reps === set.reps && v.durationSec === set.durationSec && v.rir === set.rir) return;
    if (done) return; // las correcciones de series confirmadas se guardan con el botón
    setSave('saving');
    try {
      const pr = updateSet(set.id, v, revRef.current).then((saved) => {
        revRef.current = saved.rev;
      });
      pending.current = pr;
      await pr;
      setSave('saved');
    } catch (e) {
      setSave('error');
      setErr(e instanceof ConflictError ? 'Esta serie cambió en otra pestaña. Revisa los valores.' : describeStorageError(e));
    }
  }

  async function doConfirm(force = false) {
    if (busy.current) return;
    const p = parsed();
    if ('error' in p) {
      setErr(p.error ?? null);
      return;
    }
    const check = checkSetForConfirm(p.values, { measure: se.variant.measure, loadConvention: se.variant.loadConvention });
    if (check.errors.length) {
      setErr(check.errors.join(' '));
      return;
    }
    if (check.warnings.length && !force) {
      setWarn(check.warnings);
      return;
    }
    setWarn(null);
    setErr(null);
    busy.current = true;
    setConfirming(true);
    setSave('saving');
    try {
      await pending.current?.catch(() => undefined);
      if (done && editing) {
        const fixed = await updateSet(set.id, p.values, revRef.current);
        revRef.current = fixed.rev;
        setEditing(false);
        setSave('saved');
        toast({ message: 'Corrección guardada. Los récords se recalcularon.', tone: 'ok' });
        return;
      }
      const { saved, records } = await confirmWithRecords({ ...set, rev: revRef.current }, p.values, se);
      revRef.current = saved.rev;
      setSave('saved');
      if (historical) {
        toast({ message: 'Serie registrada en la sesión pasada. Las estadísticas se recalcularon.', tone: 'ok', action: { label: 'Deshacer', run: () => void uncompleteSet(saved.id) } });
        return;
      }
      const rest = restAfter(saved, se);
      if (rest > 0 && (prefs?.autoStartRest ?? true)) await startRestTimer(se.sessionId, saved.id, rest);
      if (records.length) {
        toast({
          tone: 'celebrate',
          message: `Nuevo récord: ${records.map((r) => PR_LABEL[r.type].toLowerCase()).join(', ')}.`,
          action: { label: 'Deshacer serie', run: () => void uncompleteSet(saved.id) },
        });
      } else {
        toast({ message: 'Serie guardada.', tone: 'ok', action: { label: 'Deshacer', run: () => void uncompleteSet(saved.id) } });
      }
    } catch (e) {
      setSave('error');
      setErr(e instanceof ConflictError ? 'Esta serie cambió en otra pestaña. Revisa los valores y vuelve a confirmar.' : describeStorageError(e));
    } finally {
      busy.current = false;
      setConfirming(false);
    }
  }

  function fillSuggestion() {
    if (!suggestion) return;
    if (suggestion.load !== null) setLoad(formatDecimal(suggestion.load));
    if (suggestion.reps !== null) setReps(String(suggestion.reps));
    if (suggestion.durationSec !== null) setDur(durationText(suggestion.durationSec));
  }

  const label = set.kind === 'warmup' ? 'C' : (workNumber ?? '–');
  const sideLabel = set.side === 'left' ? 'Izq.' : set.side === 'right' ? 'Der.' : null;
  const unit = se.unit;

  return (
    <li className={`rounded-xl border px-2 py-2 ${done ? 'border-ok/40 bg-ok/5' : 'border-line bg-surface-2'} ${done && !editing ? 'anim-pop' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="flex w-10 flex-none flex-col items-center text-center" aria-label={set.kind === 'warmup' ? 'Serie de calentamiento' : `Serie de trabajo ${workNumber}`}>
          <span className={`text-lg font-bold ${set.kind === 'warmup' ? 'text-warn' : ''}`}>{label}</span>
          {sideLabel && <span className="text-[10px] text-muted">{sideLabel}</span>}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5">
          {se.variant.loadConvention !== 'none' && (
            <NumInput
              label={`Carga (${loadLabel(se.variant.loadConvention, se.variant.implements, unit)})`}
              short={unit}
              value={load}
              onChange={setLoad}
              onFocus={() => (focused.current = true)}
              onBlur={saveDraft}
              placeholder={suggestion?.load != null ? formatDecimal(suggestion.load) : ''}
              disabled={locked}
              decimal
            />
          )}
          {isTime ? (
            <NumInput label="Duración (s o m:ss)" short="s" value={dur} onChange={setDur} onFocus={() => (focused.current = true)} onBlur={saveDraft} placeholder={suggestion?.durationSec != null ? durationText(suggestion.durationSec) : ''} disabled={locked} />
          ) : (
            <NumInput
              label={se.prescribed.repsMode === 'per-side' && set.side === null ? 'Repeticiones por lado' : 'Repeticiones'}
              short={se.prescribed.repsMode === 'per-side' && set.side === null ? 'rep/lado' : 'rep'}
              value={reps}
              onChange={setReps}
              onFocus={() => (focused.current = true)}
              onBlur={saveDraft}
              placeholder={suggestion?.reps != null ? String(suggestion.reps) : ''}
              disabled={locked}
            />
          )}
          <NumInput label="RIR (opcional)" short="RIR" value={rir} onChange={setRir} onFocus={() => (focused.current = true)} onBlur={saveDraft} placeholder="" disabled={locked} decimal />
        </div>
        <div className="flex flex-none items-center gap-1">
          {done && !editing ? (
            <button
              type="button"
              className="h-12 w-12 rounded-xl bg-ok/20 text-xl text-ok"
              aria-label="Serie confirmada. Tocar para corregir"
              disabled={!canEdit}
              onClick={() => setEditing(true)}
            >
              ✓
            </button>
          ) : (
            <button
              type="button"
              className="h-12 w-12 rounded-xl bg-accent text-xl font-bold text-accent-ink disabled:opacity-50"
              aria-label={editing ? 'Guardar corrección' : 'Confirmar serie'}
              disabled={!canEdit || confirming}
              onClick={() => doConfirm()}
            >
              {confirming ? '…' : editing ? '💾' : '✓'}
            </button>
          )}
          <button type="button" className="h-12 w-9 rounded-xl text-muted hover:bg-surface-3" aria-label="Más acciones de la serie" aria-expanded={menu} disabled={!canEdit} onClick={() => setMenu((m) => !m)}>
            ⋯
          </button>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-12 text-xs">
        {suggestion && !done && (
          <button type="button" className="text-accent underline" onClick={fillSuggestion} disabled={!canEdit}>
            Usar {suggestion.source === 'progression' ? 'carga aceptada' : `anterior (${suggestion.fromDate})`}
          </button>
        )}
        {save === 'saving' && <span className="text-muted">Guardando…</span>}
        {save === 'saved' && <span className="text-ok">Guardado</span>}
        {set.load === 0 && <span className="text-faint">Carga externa 0 registrada explícitamente</span>}
        {err && (
          <span className="text-danger" role="alert">
            {err}
          </span>
        )}
      </div>
      {menu && canEdit && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-12">
          <Button size="sm" onClick={() => addSet(se.id, set.kind, set.id).then(() => setMenu(false))}>
            Duplicar
          </Button>
          <Button size="sm" onClick={() => moveSet(set.id, -1)}>
            ↑ Subir
          </Button>
          <Button size="sm" onClick={() => moveSet(set.id, 1)}>
            ↓ Bajar
          </Button>
          <Button size="sm" onClick={() => updateSet(set.id, { kind: set.kind === 'work' ? 'warmup' : 'work' }, set.rev).catch((e) => setErr(describeStorageError(e)))}>
            {set.kind === 'work' ? 'Marcar calentamiento' : 'Marcar de trabajo'}
          </Button>
          {done && (
            <Button size="sm" onClick={() => uncompleteSet(set.id).then(() => toast({ message: 'Serie desmarcada: ya no cuenta como realizada.', tone: 'ok' }))}>
              Desmarcar
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              await deleteSet(set.id);
              setMenu(false);
              toast({ message: 'Serie eliminada.', tone: 'ok', action: { label: 'Deshacer', run: () => void restoreSet(set.id) } });
            }}
          >
            Eliminar
          </Button>
        </div>
      )}
      <Dialog
        open={!!warn}
        onClose={() => setWarn(null)}
        title="¿Valores correctos?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setWarn(null)}>
              Revisar
            </Button>
            <Button variant="primary" onClick={() => doConfirm(true)}>
              Sí, guardar
            </Button>
          </>
        }
      >
        <ul className="list-disc pl-5 text-sm">
          {warn?.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </Dialog>
    </li>
  );
}

function NumInput({
  label,
  short,
  value,
  onChange,
  onBlur,
  onFocus,
  placeholder,
  disabled,
  decimal,
}: {
  label: string;
  short: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onFocus: () => void;
  placeholder: string;
  disabled: boolean;
  decimal?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col">
      <span className="sr-only">{label}</span>
      <div className="relative">
        <input
          className="h-12 w-full min-w-0 rounded-lg border border-line bg-surface pl-2 pr-6 text-base font-semibold tabular placeholder:font-normal placeholder:text-faint disabled:bg-transparent disabled:text-text"
          size={1}
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          onFocus={(e) => {
            onFocus();
            e.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' });
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-label={label}
          enterKeyHint="next"
          autoComplete="off"
        />
        <span className="pointer-events-none absolute right-1.5 top-1 text-[10px] text-faint" aria-hidden>
          {short}
        </span>
      </div>
    </label>
  );
}
