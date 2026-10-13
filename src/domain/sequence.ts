import { addDays, diffDays, localDateOf } from './dates';
import type { LocalDate, Program, ProgramDecision, RoutineDay, WorkoutSession } from './types';
import type { AdaptationState } from './schedule';

export interface RoutineSequence {
  nextDayId: string | null;
  nextDayNumber: number | null;
  completedCount: number;
  latestCompleted: WorkoutSession | null;
}

/** El historial completo dirige la secuencia; una fecha o una parcial nunca avanza el día. */
export function routineSequence(
  programId: string,
  days: readonly Pick<RoutineDay, 'id'>[],
  sessions: readonly WorkoutSession[],
): RoutineSequence {
  const validIds = new Set(days.map(day => day.id));
  const completed = sessions
    .filter(session => session.programId === programId && session.status === 'completed' && session.dayId !== null && validIds.has(session.dayId))
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt) || Date.parse(a.createdAt) - Date.parse(b.createdAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const latestCompleted = completed.at(-1) ?? null;
  const nextIndex = days.length === 0 ? -1 : latestCompleted ? (days.findIndex(day => day.id === latestCompleted.dayId) + 1) % days.length : 0;
  return {
    nextDayId: days[nextIndex]?.id ?? null,
    nextDayNumber: nextIndex < 0 ? null : nextIndex + 1,
    completedCount: completed.length,
    latestCompleted,
  };
}

export interface SequenceAdaptationInput {
  program: Pick<Program, 'id' | 'adaptationWeeks' | 'timeZone'>;
  daysPerWeek: number;
  today: LocalDate;
  /** Solo sesiones de días vigentes de la rutina; el helper también filtra por programa. */
  sessions: readonly WorkoutSession[];
  decisions: readonly ProgramDecision[];
}

/** La fase depende de entrenamientos completos. Las fechas solo detectan inactividad real. */
export function sequenceAdaptationState(input: SequenceAdaptationInput): AdaptationState {
  const { program, today } = input;
  const activity = input.sessions.filter(session => session.programId === program.id && (session.status === 'completed' || session.status === 'partial'));
  const completedCount = activity.filter(session => session.status === 'completed').length;
  const expected = program.adaptationWeeks * input.daysPerWeek;
  const decisions = input.decisions.filter(decision => decision.programId === program.id && (decision.kind === 'keep-adaptation' || decision.kind === 'end-adaptation'));
  const latestEnd = Math.max(-Infinity, ...decisions.filter(decision => decision.kind === 'end-adaptation').map(decision => Date.parse(decision.createdAt)));
  const latestKeep = Math.max(-Infinity, ...decisions.filter(decision => decision.kind === 'keep-adaptation').map(decision => Date.parse(decision.createdAt)));
  const explicitlyEnded = latestEnd > latestKeep;

  if (expected > 0 && !explicitlyEnded) {
    return {
      active: true,
      pendingDecision: completedCount >= expected,
      reason: completedCount >= expected
        ? `Completaste ${completedCount} entrenamientos; el objetivo de adaptación era ${expected}. Confirma antes de pasar a las series completas.`
        : `Adaptación: ${completedCount} de ${expected} entrenamientos completos. Faltar no adelanta esta fase.`,
    };
  }

  const lastDate = activity.map(session => session.localDate).sort().at(-1);
  if (lastDate && diffDays(lastDate, today) >= 14) {
    const gapStart = addDays(lastDate, 14);
    const decidedAfterGap = decisions.some(decision => localDateOf(new Date(decision.createdAt), program.timeZone) >= gapStart);
    if (!decidedAfterGap) {
      return { active: false, pendingDecision: true, reason: `Han pasado ${diffDays(lastDate, today)} días desde tu última sesión.` };
    }
  }
  return { active: false, pendingDecision: false, reason: 'Adaptación completada.' };
}
