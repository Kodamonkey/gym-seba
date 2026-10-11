import type {
  ID,
  Laterality,
  LoadConvention,
  LoadUnit,
  MeasureKind,
  RepsMode,
  SetLog,
  SessionExercise,
} from './types';

/**
 * Cargas, normalización y volumen registrado.
 *
 * Volumen registrado = carga normalizada (kg) × repeticiones válidas × lados contados.
 * No es trabajo mecánico, ni calorías, ni una medida universal de esfuerzo.
 */

export const LB_TO_KG = 0.45359237;

export function toKg(value: number, unit: LoadUnit): number {
  return unit === 'kg' ? value : Math.round(value * LB_TO_KG * 1000) / 1000;
}

export interface LoadContext {
  loadConvention: LoadConvention;
  implements: 1 | 2;
  laterality: Laterality;
  measure: MeasureKind;
  unit: LoadUnit;
  /** Resistencia base declarada y copiada en la sesión; null = desconocida (no se suma). */
  baseResistance: number | null;
  repsMode: RepsMode;
}

export function loadContextOf(se: SessionExercise): LoadContext {
  return {
    loadConvention: se.variant.loadConvention,
    implements: se.variant.implements,
    laterality: se.variant.laterality,
    measure: se.variant.measure,
    unit: se.unit,
    baseResistance: se.baseResistance,
    repsMode: se.prescribed.repsMode,
  };
}

/** Carga externa por repetición en kg, según la convención. null si no hay carga registrable. */
export function normalizedLoadKg(load: number | null, ctx: LoadContext): number | null {
  if (load === null || ctx.loadConvention === 'none') return null;
  let value = load;
  switch (ctx.loadConvention) {
    case 'per-implement':
      value = load * ctx.implements;
      break;
    case 'plates-added':
      value = load + (ctx.baseResistance ?? 0);
      break;
    default:
      value = load;
  }
  return toKg(value, ctx.unit);
}

/**
 * Cuántos lados representa una fila.
 * Unilateral con una sola fila y repeticiones "por lado" ⇒ 2. Filas por lado ⇒ 1.
 */
export function sidesCounted(set: Pick<SetLog, 'side'>, ctx: LoadContext): 1 | 2 {
  if (ctx.laterality !== 'unilateral') return 1;
  if (set.side !== null) return 1;
  return ctx.repsMode === 'per-side' ? 2 : 1;
}

/** Volumen registrado de una serie (kg·repeticiones) o null si no aplica. */
export function setVolumeKg(
  set: Pick<SetLog, 'load' | 'reps' | 'side'>,
  ctx: LoadContext,
): number | null {
  if (ctx.measure !== 'reps') return null;
  const kg = normalizedLoadKg(set.load, ctx);
  if (kg === null || set.reps === null) return null;
  return Math.round(kg * set.reps * sidesCounted(set, ctx) * 1000) / 1000;
}

/** Texto visible de la convención de carga. */
export function loadLabel(convention: LoadConvention, implementsCount: 1 | 2, unit: LoadUnit = 'kg'): string {
  switch (convention) {
    case 'per-implement':
      return implementsCount === 2 ? `${unit} por mancuerna (×2)` : `${unit} del implemento`;
    case 'total-external':
      return `${unit} totales (barra + discos)`;
    case 'plates-added':
      return `${unit} en discos añadidos`;
    case 'machine-stack':
      return `${unit} indicados en la pila`;
    case 'nominal':
      return `${unit} nominales`;
    case 'none':
      return 'sin carga externa';
  }
}

/** Explicación de cómo se normaliza la carga para el volumen. */
export function describeNormalization(ctx: LoadContext): string {
  const parts: string[] = [];
  switch (ctx.loadConvention) {
    case 'per-implement':
      parts.push(
        ctx.implements === 2
          ? 'Se registra el peso de cada mancuerna; el volumen usa la suma de ambas.'
          : 'Se registra el peso del implemento.',
      );
      break;
    case 'plates-added':
      parts.push(
        ctx.baseResistance !== null
          ? `Discos añadidos + resistencia base declarada (${ctx.baseResistance} ${ctx.unit}).`
          : 'Solo discos añadidos: la resistencia de la barra no se conoce y no se suma.',
      );
      break;
    case 'machine-stack':
      parts.push('Valor nominal de la pila; no es comparable con otras máquinas.');
      break;
    case 'total-external':
      parts.push('Carga externa total (barra + discos).');
      break;
    case 'nominal':
      parts.push('Resistencia nominal declarada.');
      break;
    case 'none':
      parts.push('Sin carga externa: no se calcula volumen de carga.');
  }
  if (ctx.laterality === 'unilateral') {
    parts.push(
      ctx.repsMode === 'per-side'
        ? 'Unilateral: una fila con repeticiones por lado cuenta ambos lados; una fila por lado cuenta solo ese lado.'
        : 'Unilateral con repeticiones totales: cada fila se cuenta una vez.',
    );
  }
  if (ctx.unit === 'lb') parts.push(`Conversión: lb × ${LB_TO_KG} = kg.`);
  return parts.join(' ');
}

/* ---------- Comparabilidad ---------- */

export interface ComparableInput {
  variantId: ID;
  equipmentInstanceId: ID | null;
  config: Record<string, string>;
  laterality: Laterality;
  loadConvention: LoadConvention;
  requiresEquipmentInstance: boolean;
}

export interface ComparisonKey {
  key: string;
  /** false ⇒ "comparabilidad no confirmada" (equipo sin identificar). */
  confirmed: boolean;
}

export function comparisonKey(input: ComparableInput): ComparisonKey {
  const cfg = Object.keys(input.config)
    .sort()
    .map((k) => `${k}=${input.config[k]}`)
    .join(',');
  const equipment = input.requiresEquipmentInstance ? (input.equipmentInstanceId ?? 'unidentified') : 'free';
  return {
    key: [input.variantId, equipment, cfg, input.laterality, input.loadConvention].join('|'),
    confirmed: !input.requiresEquipmentInstance || input.equipmentInstanceId !== null,
  };
}

export function comparisonKeyOf(se: SessionExercise): ComparisonKey {
  return comparisonKey({
    variantId: se.variantId,
    equipmentInstanceId: se.equipmentInstanceId,
    config: se.variant.config,
    laterality: se.variant.laterality,
    loadConvention: se.variant.loadConvention,
    requiresEquipmentInstance: se.variant.requiresEquipmentInstance,
  });
}
