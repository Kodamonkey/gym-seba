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
 * Lo escrito se guarda como borrador al escribir o salir del campo; solo cuenta al marcarla como hecha.
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
  const savedRef = useRef(set);
  const rawRef = useRef({ load, reps, dur });
  const pending = useRef<Promise<void> | null>(null);
  const debounce = useRef<number | null>(null);
  const dirty = useRef(false);
  const editVersion = useRef(0);
  const generation = useRef(0);
  const saving = useRef(0);
  const mounted = useRef(true);
  const current = useRef({ set, canEdit });
  current.current = { set, canEdit };
  const previousPermission = useRef(canEdit);
  const flush = useRef<(reportError?: boolean) => Promise<void>>(async () => undefined);

  const isTime = se.variant.measure === 'time';
  const hasLoad = se.variant.loadConvention !== 'none';
  const done = set.status === 'completed';
  const locked = !canEdit || done || busy;

  function cancelDebounce() {
    if (debounce.current !== null) window.clearTimeout(debounce.current);
    debounce.current = null;
  }

  function syncValues(next: SetLog) {
    savedRef.current = next;
    rawRef.current = { load: formatDecimal(next.load), reps: next.reps?.toString() ?? '', dur: durationText(next.durationSec) };
    dirty.current = false;
    if (!mounted.current) return;
    setLoad(rawRef.current.load);
    setReps(rawRef.current.reps);
    setDur(rawRef.current.dur);
    setWarn(null);
  }

  function reconcileExternal() {
    const latest = current.current.set;
    if (saving.current > 0 || latest.rev <= savedRef.current.rev) return;
    // Una revisión ajena nunca se usa para guardar los valores locales anteriores.
    const wasDirty = dirty.current;
    cancelDebounce();
    generation.current += 1;
    syncValues(latest);
    if (wasDirty && mounted.current) setErr('La serie cambió en otra pestaña. Revisa sus valores antes de continuar.');
  }

  // Al perder el control se cancelan los borradores pendientes y se adoptan los datos actuales.
  useEffect(() => {
    if (previousPermission.current !== canEdit) {
      previousPermission.current = canEdit;
      cancelDebounce();
      generation.current += 1;
      syncValues(set.rev >= savedRef.current.rev ? set : savedRef.current);
    }
    reconcileExternal();
  }, [set, canEdit]);

  useEffect(() => {
    mounted.current = true;
    const onHidden = () => {
      if (document.visibilityState === 'hidden') void flush.current();
    };
    const onPageHide = () => { void flush.current(); };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
      // La navegación interna también conserva el último campo, aunque mantuviera el foco.
      void flush.current();
      mounted.current = false;
    };
  }, []);

  function parse(raw: { load: string; reps: string; dur: string }) {
    const l = hasLoad ? parseLoad(raw.load) : { ok: true as const, value: null };
    const r = isTime ? { ok: true as const, value: null } : parseReps(raw.reps);
    const d = isTime ? parseDuration(raw.dur) : { ok: true as const, value: null };
    const firstErr = [l, r, d].find((x) => !x.ok) as { ok: false; error: string } | undefined;
    if (firstErr) return { error: firstErr.error } as const;
    return { values: { load: l.ok ? l.value : null, reps: r.ok ? r.value : null, durationSec: d.ok ? d.value : null } } as const;
  }

  async function saveDraft(reportError = false) {
    cancelDebounce();
    if (!current.current.canEdit || savedRef.current.status === 'completed' || busyRef.current || !dirty.current) return;
    const p = parse(rawRef.current);
    if ('error' in p) {
      // Una coma a medio escribir no interrumpe la entrada; al salir sí se explica el error.
      if (reportError && mounted.current) setErr(p.error ?? null);
      return;
    }
    if (mounted.current) setErr(null);
    const v = p.values;
    const version = editVersion.current;
    const epoch = generation.current;
    saving.current += 1;
    const pr = (pending.current ?? Promise.resolve())
      .then(async () => {
        if (epoch !== generation.current || !current.current.canEdit || savedRef.current.status === 'completed') return;
        const last = savedRef.current;
        if (v.load !== last.load || v.reps !== last.reps || v.durationSec !== last.durationSec) {
          const saved = await updateSet(last.id, v, last.rev);
          if (epoch !== generation.current) return;
          savedRef.current = saved;
        }
        if (version === editVersion.current) dirty.current = false;
      })
      .catch((e: unknown) => {
        generation.current += 1;
        if (mounted.current) setErr(userMessage(e));
      });
    pending.current = pr;
    try {
      // Los guardados se encadenan: cada uno usa la revisión que dejó el anterior.
      await pr;
    } finally {
      saving.current -= 1;
      if (pending.current === pr) pending.current = null;
      reconcileExternal();
    }
  }
  flush.current = saveDraft;

  function change(field: 'load' | 'reps' | 'dur', value: string) {
    rawRef.current = { ...rawRef.current, [field]: value };
    if (field === 'load') setLoad(value);
    else if (field === 'reps') setReps(value);
    else setDur(value);
    dirty.current = true;
    editVersion.current += 1;
    setErr(null);
    cancelDebounce();
    debounce.current = window.setTimeout(() => { void saveDraft(); }, 250);
  }

  async function confirm(force = false) {
    if (busyRef.current || !canEdit) return;
    cancelDebounce();
    // Campo vacío = repetir lo de la última vez (lo que se ve en gris).
    const raw = {
      load: rawRef.current.load.trim() || (suggestion?.load != null ? formatDecimal(suggestion.load) : ''),
      reps: rawRef.current.reps.trim() || (suggestion?.reps != null ? String(suggestion.reps) : ''),
      dur: rawRef.current.dur.trim() || durationText(suggestion?.durationSec ?? null),
    };
    const p = parse(raw);
    if ('error' in p) return setErr(p.error ?? null);
    const missing = [hasLoad && p.values.load === null && se.unit, !isTime && p.values.reps === null && 'reps', isTime && p.values.durationSec === null && 'segundos'].filter(Boolean);
    if (missing.length) return setErr(`Escribe ${missing.join(' y ')}${hasLoad && p.values.load === null ? ' (0 si no usas peso)' : ''}.`);
    const check = checkSetForConfirm({ ...p.values, rir: set.rir }, { measure: se.variant.measure, loadConvention: se.variant.loadConvention });
    if (check.errors.length) return setErr(check.errors.join(' '));
    if (check.warnings.length && !force) return setWarn(check.warnings);
    setWarn(null);
    setErr(null);
    setLoad(raw.load);
    setReps(raw.reps);
    setDur(raw.dur);
    rawRef.current = raw;
    const epoch = generation.current;
    busyRef.current = true;
    setBusy(true);
    try {
      await pending.current;
      if (epoch !== generation.current || !current.current.canEdit) return;
      const saved = await confirmSet(set.id, p.values, savedRef.current.rev);
      savedRef.current = saved;
      dirty.current = false;
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
    if (!canEdit || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const saved = await uncompleteSet(set.id);
      savedRef.current = saved;
    } catch (e) {
      setErr(userMessage(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const perSide = se.prescribed.repsMode === 'per-side' && set.side === null;
  const repsLabel = isTime ? (perSide ? 'Segundos por lado' : 'Segundos') : perSide ? 'Repeticiones por lado' : 'Repeticiones';

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
            onChange={(value) => change('load', value)}
            onBlur={() => { void saveDraft(true); }}
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
          onChange={(value) => change(isTime ? 'dur' : 'reps', value)}
          onBlur={() => { void saveDraft(true); }}
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
    const viewportTop = vv?.offsetTop ?? 0;
    const viewportBottom = viewportTop + (vv?.height ?? window.innerHeight);
    const header = document.querySelector<HTMLElement>('header.sticky')?.getBoundingClientRect();
    const timer = document.querySelector<HTMLElement>('[aria-label="Descanso"][role="region"]')?.getBoundingClientRect();
    const top = Math.max(viewportTop, header?.bottom ?? viewportTop) + 16;
    const bottom = Math.min(viewportBottom, timer?.top ?? viewportBottom) - 16;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > bottom || rect.top < top) el.scrollIntoView({ block: 'center', behavior: 'auto' });
  }, 300);
}
