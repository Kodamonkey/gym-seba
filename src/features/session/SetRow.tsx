import { useEffect, useRef, useState } from 'react';
import type { SessionExercise, SetLog } from '../../domain/types';
import { checkSetForConfirm, formatDecimal, parseDuration, parseLoad, parseReps } from '../../domain/validation';
import { userMessage } from '../../data/db';
import { confirmSet, uncompleteSet, updateSet } from '../../data/sessions';
import { startRestTimer } from '../../data/timers';
import { usePrefs } from '../../app/hooks';
import { CheckIcon } from '../../ui/icons';
import { Button, Dialog } from '../../ui/primitives';
import { restAfter, type Suggestion } from './logic';

interface Props {
  set: SetLog;
  se: SessionExercise;
  /** Valores de la última vez: se muestran en gris y se usan si confirmas con el campo vacío. */
  suggestion?: Suggestion | undefined;
  canEdit: boolean;
  label: string;
}

const durationText = (s: number | null) => (s === null ? '' : s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s));

/**
 * Fila de serie: carga, repeticiones (o segundos) y el botón de hecho.
 * Lo escrito se guarda como borrador al salir del campo; solo cuenta al marcarla como hecha.
 * Tocar el check de una serie hecha la vuelve a abrir para corregirla.
 */
export function SetRow({ set, se, suggestion, canEdit, label }: Props) {
  const prefs = usePrefs();
  const [load, setLoad] = useState(formatDecimal(set.load));
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [dur, setDur] = useState(durationText(set.durationSec));
  const [err, setErr] = useState<string | null>(null);
  const [warn, setWarn] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const repsRef = useRef<HTMLInputElement>(null);
  // Última revisión conocida y guardado de borrador en curso: evita conflictos falsos
  // cuando se sale del campo y se toca el check en el mismo gesto.
  const revRef = useRef(set.rev);
  const pending = useRef<Promise<unknown> | null>(null);
  const focused = useRef(false);
  const saving = useRef(0);
  useEffect(() => {
    revRef.current = Math.max(revRef.current, set.rev);
  }, [set.rev]);

  const isTime = se.variant.measure === 'time';
  const hasLoad = se.variant.loadConvention !== 'none';
  const done = set.status === 'completed';
  const locked = !canEdit || done;

  // Sincroniza con cambios externos (otra pestaña, deshacer) si no se está escribiendo.
  useEffect(() => {
    if (focused.current || saving.current > 0) return;
    setLoad(formatDecimal(set.load));
    setReps(set.reps?.toString() ?? '');
    setDur(durationText(set.durationSec));
  }, [set.load, set.reps, set.durationSec, set.rev]);

  function parse(raw: { load: string; reps: string; dur: string }) {
    const l = hasLoad ? parseLoad(raw.load) : { ok: true as const, value: null };
    const r = isTime ? { ok: true as const, value: null } : parseReps(raw.reps);
    const d = isTime ? parseDuration(raw.dur) : { ok: true as const, value: null };
    const firstErr = [l, r, d].find((x) => !x.ok) as { ok: false; error: string } | undefined;
    if (firstErr) return { error: firstErr.error } as const;
    return { values: { load: l.ok ? l.value : null, reps: r.ok ? r.value : null, durationSec: d.ok ? d.value : null } } as const;
  }

  async function saveDraft() {
    focused.current = false;
    if (locked) return;
    const p = parse({ load, reps, dur });
    if ('error' in p) return setErr(p.error ?? null);
    setErr(null);
    const v = p.values;
    if (v.load === set.load && v.reps === set.reps && v.durationSec === set.durationSec) return;
    saving.current += 1;
    try {
      // Los guardados se encadenan: cada uno usa la revisión que dejó el anterior.
      const pr = (pending.current ?? Promise.resolve())
        .catch(() => undefined)
        .then(() => updateSet(set.id, v, revRef.current))
        .then((saved) => {
          revRef.current = saved.rev;
        });
      pending.current = pr;
      await pr;
    } catch (e) {
      setErr(userMessage(e));
    } finally {
      saving.current -= 1;
    }
  }

  async function confirm(force = false) {
    if (busyRef.current || !canEdit) return;
    // Campo vacío = repetir lo de la última vez (lo que se ve en gris).
    const raw = {
      load: load.trim() || (suggestion?.load != null ? formatDecimal(suggestion.load) : ''),
      reps: reps.trim() || (suggestion?.reps != null ? String(suggestion.reps) : ''),
      dur: dur.trim() || durationText(suggestion?.durationSec ?? null),
    };
    const p = parse(raw);
    if ('error' in p) return setErr(p.error ?? null);
    const missing = [hasLoad && p.values.load === null && 'kg', !isTime && p.values.reps === null && 'reps', isTime && p.values.durationSec === null && 'segundos'].filter(Boolean);
    if (missing.length) return setErr(`Escribe ${missing.join(' y ')}${hasLoad && p.values.load === null ? ' (0 si no usas peso)' : ''}.`);
    const check = checkSetForConfirm({ ...p.values, rir: set.rir }, { measure: se.variant.measure, loadConvention: se.variant.loadConvention });
    if (check.errors.length) return setErr(check.errors.join(' '));
    if (check.warnings.length && !force) return setWarn(check.warnings);
    setWarn(null);
    setErr(null);
    setLoad(raw.load);
    setReps(raw.reps);
    setDur(raw.dur);
    busyRef.current = true;
    setBusy(true);
    try {
      await pending.current?.catch(() => undefined);
      const saved = await confirmSet(set.id, p.values, revRef.current);
      revRef.current = saved.rev;
      const rest = restAfter(saved, se);
      if (rest > 0 && (prefs?.autoStartRest ?? true)) await startRestTimer(se.sessionId, saved.id, rest);
    } catch (e) {
      setErr(userMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function reopen() {
    if (!canEdit) return;
    try {
      const saved = await uncompleteSet(set.id);
      revRef.current = saved.rev;
    } catch (e) {
      setErr(userMessage(e));
    }
  }

  const repsLabel = isTime ? 'Segundos' : se.prescribed.repsMode === 'per-side' && set.side === null ? 'Repeticiones por lado' : 'Repeticiones';

  return (
    <li>
      <div className={`grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 rounded-2xl py-1 pr-1 transition-colors ${done ? 'bg-ok/8' : ''}`}>
        <span className={`text-center text-[15px] font-semibold tabular ${done ? 'text-ok' : 'text-muted'}`} aria-label={`Serie ${label}`}>
          {label}
        </span>
        {hasLoad ? (
          <NumInput
            label={`Carga serie ${label}`}
            value={load}
            onChange={setLoad}
            onFocus={() => (focused.current = true)}
            onBlur={saveDraft}
            onEnter={() => repsRef.current?.focus()}
            placeholder={suggestion?.load != null ? formatDecimal(suggestion.load) : ''}
            disabled={locked}
            decimal
            enterKeyHint="next"
          />
        ) : (
          <span className="text-center text-faint" aria-hidden>
            —
          </span>
        )}
        <NumInput
          ref={repsRef}
          label={`${repsLabel} serie ${label}`}
          value={isTime ? dur : reps}
          onChange={isTime ? setDur : setReps}
          onFocus={() => (focused.current = true)}
          onBlur={saveDraft}
          onEnter={() => {
            repsRef.current?.blur();
            void confirm();
          }}
          placeholder={isTime ? durationText(suggestion?.durationSec ?? null) : suggestion?.reps != null ? String(suggestion.reps) : ''}
          disabled={locked}
          enterKeyHint="done"
        />
        <button
          type="button"
          onClick={() => (done ? reopen() : confirm())}
          disabled={!canEdit || busy}
          aria-label={done ? `Serie ${label} hecha. Tocar para corregir` : `Marcar serie ${label} como hecha`}
          aria-pressed={done}
          className={`inline-flex h-12 w-12 items-center justify-center justify-self-end rounded-full transition-colors duration-150 disabled:opacity-40 ${
            done ? 'bg-ok text-white' : 'border-2 border-surface-3 text-faint active:bg-surface-2'
          }`}
        >
          <CheckIcon size={22} strokeWidth={3} />
        </button>
      </div>
      {err && (
        <p className="pb-1 pl-10 pr-2 text-[13px] text-danger" role="alert">
          {err}
        </p>
      )}
      <Dialog
        open={!!warn}
        onClose={() => setWarn(null)}
        title="¿Valores correctos?"
        footer={
          <>
            <Button variant="primary" size="lg" onClick={() => confirm(true)}>
              Sí, guardar
            </Button>
            <Button size="lg" onClick={() => setWarn(null)}>
              Revisar
            </Button>
          </>
        }
      >
        <ul className="list-disc pl-5 text-[15px] text-muted">
          {warn?.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </Dialog>
    </li>
  );
}

const NumInput = ({
  ref,
  label,
  value,
  onChange,
  onBlur,
  onFocus,
  onEnter,
  placeholder,
  disabled,
  decimal,
  enterKeyHint,
}: {
  ref?: React.Ref<HTMLInputElement>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  onFocus: () => void;
  onEnter: () => void;
  placeholder: string;
  disabled: boolean;
  decimal?: boolean;
  enterKeyHint: 'next' | 'done';
}) => (
  <input
    ref={ref}
    className="h-12 w-full min-w-0 rounded-xl bg-surface-2 text-center text-[17px] font-semibold tabular text-text placeholder:font-medium placeholder:text-faint focus:bg-surface focus:outline-2 focus:outline-text disabled:bg-transparent"
    size={1}
    inputMode={decimal ? 'decimal' : 'numeric'}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    onBlur={onBlur}
    onFocus={(e) => {
      onFocus();
      ensureVisible(e.currentTarget);
    }}
    onKeyDown={(e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onEnter();
      }
    }}
    placeholder={placeholder}
    disabled={disabled}
    aria-label={label}
    enterKeyHint={enterKeyHint}
    autoComplete="off"
  />
);

/**
 * Tras abrir el teclado, si el campo quedó tapado (teclado o temporizador), lo centra
 * sin animación para no mover botones mientras se tocan.
 */
function ensureVisible(el: HTMLElement) {
  window.setTimeout(() => {
    if (document.activeElement !== el) return;
    const vv = window.visualViewport;
    const height = vv ? vv.height : window.innerHeight;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > height - 120 || rect.top < 64) el.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, 300);
}
