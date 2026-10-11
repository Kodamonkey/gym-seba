import type { LoadUnit, MeasureKind, Prescription, SetLog } from './types';
import { formatDecimal } from './validation';

/**
 * Doble progresión explicable. Nunca aplica cambios: solo sugiere y explica el motivo.
 * La decisión (aceptar, posponer, ajustar) siempre la toma el usuario.
 */

export interface ProgressionInput {
  prescribed: Prescription;
  measure: MeasureKind;
  /** Series de trabajo completadas de este ejercicio en la sesión. */
  workSets: Pick<SetLog, 'load' | 'reps' | 'rir' | 'side'>[];
  perSideRows: boolean;
  techniqueConfirmed: boolean | null;
  painReported: boolean;
  sessionComplete: boolean;
  minIncrement: number | null;
  unit: LoadUnit;
}

export type ProgressionAdvice =
  | { kind: 'suggest-increase'; message: string; from: number; to: number | null; unit: LoadUnit }
  | { kind: 'needs-confirmation'; message: string; missing: ('rir' | 'technique')[] }
  | { kind: 'hold'; message: string }
  | { kind: 'none'; message: string };

export function adviseProgression(input: ProgressionInput): ProgressionAdvice {
  const { prescribed: p } = input;

  if (input.painReported) {
    return { kind: 'hold', message: 'Registraste dolor en este ejercicio: no se sugiere aumentar la carga.' };
  }
  if (input.techniqueConfirmed === false) {
    return { kind: 'hold', message: 'Indicaste que la técnica no fue la adecuada: mantén la carga.' };
  }
  if (input.measure !== 'reps') {
    return { kind: 'none', message: 'Ejercicio por tiempo: la doble progresión por repeticiones no aplica.' };
  }
  if (!input.sessionComplete) {
    return { kind: 'hold', message: 'La sesión quedó incompleta: no se sugiere aumentar.' };
  }

  const expected = p.sets * (input.perSideRows ? 2 : 1);
  if (input.workSets.length < expected) {
    return { kind: 'hold', message: `Completaste ${input.workSets.length} de ${expected} series de trabajo prescritas.` };
  }

  const loads = new Set(input.workSets.map((s) => s.load));
  if (loads.size !== 1 || input.workSets[0]?.load == null) {
    return { kind: 'none', message: 'Usaste cargas distintas o sin registrar: la sugerencia necesita una carga fija.' };
  }
  const load = input.workSets[0].load;

  if (input.workSets.some((s) => s.reps === null || s.reps < p.repMax)) {
    return {
      kind: 'none',
      message: `Mantén ${formatDecimal(load)} ${input.unit} hasta completar ${p.repMax} repeticiones en todas las series.`,
    };
  }

  const missing: ('rir' | 'technique')[] = [];
  if (input.techniqueConfirmed === null) missing.push('technique');
  if (input.workSets.some((s) => s.rir === null)) missing.push('rir');
  if (missing.length > 0) {
    return {
      kind: 'needs-confirmation',
      missing,
      message: 'Llegaste al tope del rango. Para sugerir un aumento confirma la técnica y el RIR de las series.',
    };
  }

  if (input.workSets.some((s) => (s.rir ?? 0) < p.rirMin)) {
    return {
      kind: 'hold',
      message: `Llegaste al tope con un RIR menor que el objetivo (${p.rirMin}–${p.rirMax}). Consolida esta carga.`,
    };
  }

  const setsText = `${p.sets} × ${p.repMax}${p.repsMode === 'per-side' ? ' por lado' : ''}`;
  const to = input.minIncrement !== null ? Math.round((load + input.minIncrement) * 1000) / 1000 : null;
  return {
    kind: 'suggest-increase',
    from: load,
    to,
    unit: input.unit,
    message:
      to !== null
        ? `Completaste ${setsText} con esta carga. Puedes considerar el siguiente incremento disponible: ${formatDecimal(to)} ${input.unit}.`
        : `Completaste ${setsText} con esta carga. Puedes considerar el siguiente incremento disponible (configura el incremento mínimo del equipo).`,
  };
}
