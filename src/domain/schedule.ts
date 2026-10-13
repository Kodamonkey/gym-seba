import { addDays, diffDays, isoWeekday, startOfWeek } from './dates';
import type {
  LocalDate,
  PrescribedExercise,
  Prescription,
  Program,
  ProgramDecision,
  RoutineTemplate,
  ScheduledWorkout,
  WorkoutSession,
} from './types';

/**
 * Planificación: semana de programa, adaptación, recurrencias y estados del calendario.
 * Semana calendario (lunes–domingo), semana del programa (desde la fecha de inicio)
 * y sesiones completadas son conceptos distintos.
 */

/** Semana del programa (1 = primera). Puede ser ≤ 0 antes del inicio. */
export function programWeek(startDate: LocalDate, date: LocalDate): number {
  return Math.floor(diffDays(startDate, date) / 7) + 1;
}

export function programEndDate(program: Pick<Program, 'startDate' | 'weeks'>): LocalDate {
  return addDays(program.startDate, program.weeks * 7 - 1);
}

/** Fechas generadas por la recurrencia semanal del programa. */
export function recurrenceDates(
  program: Pick<Program, 'startDate' | 'weeks' | 'weekdays'>,
  dayIds: string[],
): { dayId: string; date: LocalDate }[] {
  const out: { dayId: string; date: LocalDate }[] = [];
  const end = programEndDate(program);
  for (let d = program.startDate; d <= end; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    for (const dayId of dayIds) {
      if (program.weekdays[dayId] === wd) out.push({ dayId, date: d });
    }
  }
  return out;
}

/* ---------- Adaptación ---------- */

export interface AdaptationState {
  active: boolean;
  /** Hay que preguntar al usuario si mantener la adaptación. */
  pendingDecision: boolean;
  reason: string;
}

export interface AdaptationInput {
  program: Pick<Program, 'startDate' | 'adaptationWeeks' | 'id'>;
  daysPerWeek: number;
  today: LocalDate;
  /** Fechas locales de sesiones completadas del programa; las parciales no cumplen la adaptación. */
  completedDates: LocalDate[];
  /** Actividad registrada, incluidas las sesiones parciales. Si se omite, usa `completedDates`. */
  activityDates?: LocalDate[];
  decisions: ProgramDecision[];
}

/**
 * La adaptación no desaparece silenciosamente:
 * - Si terminó el período pero se completó menos de la mitad de las sesiones previstas, se pregunta.
 * - Si hubo un hueco de 14 días o más sin entrenar, se ofrece volver a la adaptación.
 * Hasta que el usuario decide, se mantiene (opción conservadora).
 */
export function adaptationState(input: AdaptationInput): AdaptationState {
  const week = programWeek(input.program.startDate, input.today);
  if (week <= input.program.adaptationWeeks) {
    return { active: true, pendingDecision: false, reason: `Semana ${Math.max(1, week)} de adaptación.` };
  }

  const adaptationEnd = addDays(input.program.startDate, input.program.adaptationWeeks * 7 - 1);
  const ended = input.decisions.filter((d) => d.kind === 'end-adaptation');
  const lastEnd = ended.map((d) => d.createdAt).sort().pop() ?? null;

  const doneInAdaptation = input.completedDates.filter(
    (d) => d >= input.program.startDate && d <= adaptationEnd,
  ).length;
  const expected = input.program.adaptationWeeks * input.daysPerWeek;
  if (lastEnd === null && doneInAdaptation < Math.ceil(expected / 2)) {
    return {
      active: true,
      pendingDecision: true,
      reason: `Terminó el período de adaptación, pero completaste ${doneInAdaptation} de ${expected} sesiones previstas.`,
    };
  }

  const sorted = [...(input.activityDates ?? input.completedDates)].sort();
  const last = sorted[sorted.length - 1];
  if (last && diffDays(last, input.today) >= 14) {
    const decidedAfterGap = input.decisions.some((d) => d.createdAt.slice(0, 10) > last);
    if (!decidedAfterGap) {
      return {
        active: false,
        pendingDecision: true,
        reason: `Han pasado ${diffDays(last, input.today)} días desde tu última sesión.`,
      };
    }
  }
  return { active: false, pendingDecision: false, reason: 'Adaptación completada.' };
}

/** Prescripción efectiva según la fase: en adaptación, `setsPerExercise` series de trabajo. */
export function effectivePrescription(
  ex: PrescribedExercise,
  adaptation: boolean,
  template: Pick<RoutineTemplate, 'adaptation'>,
): Prescription {
  const sets = adaptation ? Math.min(ex.sets, template.adaptation.setsPerExercise) : ex.sets;
  return {
    sets,
    repMin: ex.repMin,
    repMax: ex.repMax,
    ...(ex.durationMin !== undefined ? { durationMin: ex.durationMin } : {}),
    ...(ex.durationMax !== undefined ? { durationMax: ex.durationMax } : {}),
    repsMode: ex.repsMode,
    restSec: ex.restSec,
    rirMin: ex.rirMin,
    rirMax: ex.rirMax,
  };
}

/* ---------- Estado de una sesión planificada ---------- */

export type PlanStatus = 'planned' | 'in-progress' | 'completed' | 'partial' | 'skipped' | 'unclassified';

export const PLAN_STATUS_LABEL: Record<PlanStatus | 'rest', string> = {
  planned: 'Planificada',
  'in-progress': 'En curso',
  completed: 'Completada',
  partial: 'Parcial',
  skipped: 'Omitida',
  unclassified: 'Sin registrar',
  rest: 'Descanso',
};

export const PLAN_STATUS_SYMBOL: Record<PlanStatus | 'rest', string> = {
  planned: '○',
  'in-progress': '◐',
  completed: '●',
  partial: '◑',
  skipped: '✕',
  unclassified: '?',
  rest: '–',
};

export function planStatus(
  sw: Pick<ScheduledWorkout, 'date' | 'skippedConfirmed' | 'sessionId'>,
  session: Pick<WorkoutSession, 'status'> | undefined,
  today: LocalDate,
): PlanStatus {
  if (session) {
    if (session.status === 'active') return 'in-progress';
    if (session.status === 'completed') return 'completed';
    if (session.status === 'partial') return 'partial';
  }
  if (sw.skippedConfirmed) return 'skipped';
  if (sw.date < today) return 'unclassified';
  return 'planned';
}

/* ---------- Cumplimiento ---------- */

export interface ComplianceSummary {
  due: number;
  completed: number;
  partial: number;
  skipped: number;
  unclassified: number;
  /** completadas / previstas hasta hoy; null si no hay sesiones previstas. */
  ratio: number | null;
}

export const COMPLIANCE_DEFINITION =
  'Cumplimiento = sesiones completadas ÷ sesiones previstas con fecha anterior a hoy (las de hoy cuentan solo si ya se registraron). ' +
  'Las parciales se muestran aparte y no cuentan como cumplidas. Una sesión reprogramada cuenta en su nueva fecha.';

export function compliance(statuses: { date: LocalDate; status: PlanStatus }[], today: LocalDate): ComplianceSummary {
  const due = statuses.filter(
    (s) => s.date < today || (s.date === today && s.status !== 'planned' && s.status !== 'in-progress'),
  );
  const count = (st: PlanStatus) => due.filter((s) => s.status === st).length;
  const completed = count('completed');
  return {
    due: due.length,
    completed,
    partial: count('partial'),
    skipped: count('skipped'),
    unclassified: count('unclassified'),
    ratio: due.length === 0 ? null : completed / due.length,
  };
}

/** Sesiones completadas por semana calendario (lunes). Semanas sin datos no aparecen (≠ 0). */
export function sessionsPerWeek(sessions: Pick<WorkoutSession, 'localDate' | 'status'>[]): Map<LocalDate, number> {
  const out = new Map<LocalDate, number>();
  for (const s of sessions) {
    if (s.status !== 'completed' && s.status !== 'partial') continue;
    const w = startOfWeek(s.localDate);
    out.set(w, (out.get(w) ?? 0) + 1);
  }
  return out;
}
