import { useLiveQuery } from 'dexie-react-hooks';
import { adaptationState, planStatus, programWeek, type PlanStatus } from '../domain/schedule';
import type { Program, RoutineDay, RoutineTemplate, ScheduledWorkout, WorkoutSession } from '../domain/types';
import { db } from '../data/db';

export interface PlannedItem {
  sw: ScheduledWorkout;
  day: RoutineDay | undefined;
  session: WorkoutSession | undefined;
  status: PlanStatus;
}

export interface PlanSnapshot {
  program: Program | undefined;
  template: RoutineTemplate | undefined;
  items: PlannedItem[];
  sessions: WorkoutSession[];
  week: number | null;
  adaptation: ReturnType<typeof adaptationState> | null;
}

/** Vista derivada del programa activo y su calendario (se actualiza en vivo). */
export function usePlan(today: string): PlanSnapshot | undefined {
  return useLiveQuery(async () => {
    const program = await db.programs.where('status').equals('active').first();
    const sessions = await db.sessions.toArray();
    if (!program) return { program: undefined, template: undefined, items: [], sessions, week: null, adaptation: null };
    const template = await db.routineTemplates.get(program.templateId);
    const sws = await db.scheduledWorkouts.where('programId').equals(program.id).toArray();
    const sessionById = new Map(sessions.map((s) => [s.id, s]));
    const items: PlannedItem[] = sws
      .map((sw) => {
        const session = sw.sessionId ? sessionById.get(sw.sessionId) : undefined;
        return { sw, day: template?.days.find((d) => d.id === sw.dayId), session, status: planStatus(sw, session, today) };
      })
      .sort((a, b) => (a.sw.date < b.sw.date ? -1 : a.sw.date > b.sw.date ? 1 : 0));
    const decisions = await db.programDecisions.where('programId').equals(program.id).toArray();
    const activity = sessions.filter((s) => s.programId === program.id && (s.status === 'completed' || s.status === 'partial'));
    const adaptation = template
      ? adaptationState({
          program,
          daysPerWeek: template.days.length,
          today,
          completedDates: activity.filter((s) => s.status === 'completed').map((s) => s.localDate),
          activityDates: activity.map((s) => s.localDate),
          decisions,
        })
      : null;
    return { program, template, items, sessions, week: programWeek(program.startDate, today), adaptation };
  }, [today]);
}
