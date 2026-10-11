import type { LoadConvention, MeasureKind, SetLog } from './types';

/**
 * Validación compartida entre interfaz, dominio e importación.
 * Un campo vacío significa "no registrado" (`null`), nunca cero.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

export const LIMITS = {
  /** Por encima de estos valores se pide confirmación, no se rechaza. */
  unusualLoad: 300,
  unusualReps: 50,
  unusualDurationSec: 600,
  maxRir: 10,
} as const;

const DECIMAL_RE = /^\d+(?:[.,]\d+)?$/;

/** Acepta `12,5` y `12.5`. Vacío ⇒ null. Rechaza negativos y texto. */
export function parseDecimal(raw: string, field = 'Valor'): Parsed<number | null> {
  const s = raw.trim();
  if (s === '') return { ok: true, value: null };
  if (s.startsWith('-')) return { ok: false, error: `${field} no puede ser negativo.` };
  if (!DECIMAL_RE.test(s)) return { ok: false, error: `${field}: usa solo números (12,5 o 12.5).` };
  const value = Number(s.replace(',', '.'));
  if (!Number.isFinite(value)) return { ok: false, error: `${field} no es un número válido.` };
  return { ok: true, value: Math.round(value * 1000) / 1000 };
}

export function parseLoad(raw: string): Parsed<number | null> {
  return parseDecimal(raw, 'La carga');
}

/** Repeticiones: enteros ≥ 0. Vacío ⇒ null. */
export function parseReps(raw: string): Parsed<number | null> {
  const s = raw.trim();
  if (s === '') return { ok: true, value: null };
  if (s.startsWith('-')) return { ok: false, error: 'Las repeticiones no pueden ser negativas.' };
  if (!/^\d+$/.test(s)) return { ok: false, error: 'Las repeticiones deben ser un número entero.' };
  return { ok: true, value: Number(s) };
}

/** RIR: 0–10, admite medios (2,5). Vacío ⇒ null. */
export function parseRir(raw: string): Parsed<number | null> {
  const r = parseDecimal(raw, 'El RIR');
  if (!r.ok || r.value === null) return r;
  if (r.value > LIMITS.maxRir) return { ok: false, error: `El RIR debe estar entre 0 y ${LIMITS.maxRir}.` };
  if (Math.round(r.value * 2) !== r.value * 2) return { ok: false, error: 'El RIR admite enteros o medios (2 o 2,5).' };
  return r;
}

/** Duración en segundos: "45" o "1:30". Vacío ⇒ null. */
export function parseDuration(raw: string): Parsed<number | null> {
  const s = raw.trim();
  if (s === '') return { ok: true, value: null };
  if (s.startsWith('-')) return { ok: false, error: 'La duración no puede ser negativa.' };
  const mmss = /^(\d+):([0-5]\d)$/.exec(s);
  if (mmss) {
    const total = Number(mmss[1]) * 60 + Number(mmss[2]);
    return total > 0 ? { ok: true, value: total } : { ok: false, error: 'La duración debe ser mayor que cero.' };
  }
  if (/^\d+$/.test(s)) {
    const total = Number(s);
    return total > 0 ? { ok: true, value: total } : { ok: false, error: 'La duración debe ser mayor que cero.' };
  }
  return { ok: false, error: 'Duración inválida: usa segundos (45) o mm:ss (1:30).' };
}

export function formatDecimal(value: number | null): string {
  if (value === null) return '';
  return String(value).replace('.', ',');
}

export interface ConfirmContext {
  measure: MeasureKind;
  loadConvention: LoadConvention;
}

export interface ConfirmCheck {
  errors: string[];
  /** Valores inusuales que requieren una confirmación explícita. */
  warnings: string[];
}

/** Reglas para poder confirmar una serie como realizada. */
export function checkSetForConfirm(
  set: Pick<SetLog, 'load' | 'reps' | 'durationSec' | 'rir'>,
  ctx: ConfirmContext,
): ConfirmCheck {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (ctx.loadConvention !== 'none') {
    if (set.load === null) errors.push('Indica la carga (puede ser 0 si no usas carga externa).');
    else if (set.load < 0 || !Number.isFinite(set.load)) errors.push('La carga no es válida.');
    else if (set.load > LIMITS.unusualLoad) warnings.push(`Carga inusualmente alta (${formatDecimal(set.load)}).`);
  }

  if (ctx.measure === 'reps') {
    if (set.reps === null) errors.push('Indica las repeticiones realizadas.');
    else if (!Number.isInteger(set.reps) || set.reps < 1) errors.push('Las repeticiones deben ser un entero mayor que cero.');
    else if (set.reps > LIMITS.unusualReps) warnings.push(`Número de repeticiones inusual (${set.reps}).`);
  } else {
    if (set.durationSec === null) errors.push('Indica la duración realizada.');
    else if (!Number.isInteger(set.durationSec) || set.durationSec <= 0) errors.push('La duración no es válida.');
    else if (set.durationSec > LIMITS.unusualDurationSec) warnings.push(`Duración inusual (${set.durationSec} s).`);
  }

  if (set.rir !== null && (set.rir < 0 || set.rir > LIMITS.maxRir)) errors.push('El RIR no es válido.');

  return { errors, warnings };
}
