import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useActiveSession, useTimeZone, useToday } from '../../app/hooks';
import { addDays, formatLocalDate, isoWeekday, startOfWeek, weekdayName } from '../../domain/dates';
import type { RoutineDay, WorkoutSession } from '../../domain/types';
import { userMessage } from '../../data/db';
import { startDay } from '../../data/overview';
import { endAdaptation, keepAdaptation } from '../../data/program';
import { ActiveSessionExistsError, sessionCompleteness } from '../../data/sessions';
import { CheckIcon, ChevronRightIcon, SettingsIcon } from '../../ui/icons';
import { Button, Loading, SectionTitle } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { usePlan } from '../plan';
import { dayMinutes, longDate, SessionRow } from '../shared';

const isDone = (s: WorkoutSession) => s.status === 'completed' || s.status === 'partial';

/** Inicio: lo que toca hoy, los días de la rutina y lo último que entrenaste. */
export function HomePage() {
  const today = useToday();
  const tz = useTimeZone();
  const plan = usePlan(today);
  const active = useActiveSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const progress = useLiveQuery(() => (active ? sessionCompleteness(active.id) : undefined), [active?.id]);

  if (!plan || active === undefined) return <Loading />;
  const { program, template } = plan;
  if (!program || !template) return <p className="py-10 text-muted">No hay una rutina activa.</p>;

  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const weekdayOf = (d: RoutineDay) => program.weekdays[d.id] ?? d.weekday;
  const days = [...template.days].sort((a, b) => weekdayOf(a) - weekdayOf(b));
  const sessions = plan.sessions.filter(isDone).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  const doneThisWeek = (dayId: string) => sessions.find((s) => s.dayId === dayId && s.localDate >= weekStart && s.localDate <= weekEnd);
  const todayDay = days.find((d) => weekdayOf(d) === isoWeekday(today));
  const nextDay = days.find((d) => weekdayOf(d) > isoWeekday(today) && !doneThisWeek(d.id)) ?? days.find((d) => !doneThisWeek(d.id));
  const week = plan.week !== null && plan.week >= 1 ? Math.min(plan.week, program.weeks) : null;

  async function start(dayId: string) {
    setBusy(true);
    try {
      await startDay(dayId, tz);
      navigate('/sesion');
    } catch (e) {
      if (e instanceof ActiveSessionExistsError) navigate('/sesion');
      else toast({ message: userMessage(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex items-start justify-between gap-2 pb-5 pt-6">
        <div>
          <p className="text-sm text-muted first-letter:uppercase">{longDate(today)}</p>
          <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">Mi rutina</h1>
          {week ? (
            <p className="mt-1 text-sm text-muted">
              Semana {week} de {program.weeks}
              {plan.adaptation?.active ? ' · adaptación' : ''}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Semana 1 empieza el {formatLocalDate(program.startDate)}</p>
          )}
        </div>
        <Link to="/ajustes" aria-label="Ajustes" className="-mr-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-muted active:bg-surface-2">
          <SettingsIcon size={22} />
        </Link>
      </header>

      {/* Lo que toca ahora */}
      {active ? (
        <section className="rounded-3xl bg-text p-5 text-bg">
          <p className="text-[13px] font-semibold uppercase tracking-wider opacity-70">En curso</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{active.title}</p>
          {progress && (
            <p className="mt-1 text-sm opacity-70 tabular">
              {progress.done} de {progress.expected} series
            </p>
          )}
          <Button size="lg" variant="inverse" className="mt-5 w-full" onClick={() => navigate('/sesion')}>
            Continuar
          </Button>
        </section>
      ) : todayDay && !doneThisWeek(todayDay.id) ? (
        <section className="rounded-3xl bg-text p-5 text-bg">
          <p className="text-[13px] font-semibold uppercase tracking-wider opacity-70">Hoy</p>
          <Link to={`/dia/${todayDay.id}`} className="mt-1 flex items-center justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight">{todayDay.name}</span>
            <ChevronRightIcon className="opacity-60" />
          </Link>
          <p className="mt-1 text-sm opacity-70">
            {todayDay.exercises.length} ejercicios · ~{dayMinutes(todayDay)} min
          </p>
          <Button size="lg" variant="inverse" busy={busy} className="mt-5 w-full" onClick={() => start(todayDay.id)}>
            Empezar
          </Button>
        </section>
      ) : (
        <section className="rounded-3xl bg-surface-2 p-5">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-muted">Hoy</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{todayDay ? 'Hecho' : 'Descanso'}</p>
          {nextDay && (
            <p className="mt-1 text-sm text-muted">
              Próximo: <span className="first-letter:uppercase">{weekdayName(weekdayOf(nextDay))}</span> · {nextDay.name}
            </p>
          )}
        </section>
      )}

      {plan.adaptation?.pendingDecision && !active && (
        <section className="mt-4 rounded-2xl border border-line p-4">
          <p className="text-[15px] font-medium">{plan.adaptation.active ? '¿Pasar a las series completas?' : '¿Volver una semana a la adaptación?'}</p>
          <p className="mt-1 text-sm text-muted">{plan.adaptation.reason}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" onClick={() => (plan.adaptation!.active ? endAdaptation(program) : keepAdaptation(program, today))}>
              Sí
            </Button>
            <Button size="sm" onClick={() => (plan.adaptation!.active ? keepAdaptation(program, today) : endAdaptation(program))}>
              Todavía no
            </Button>
          </div>
        </section>
      )}

      <section className="mt-6">
        <SectionTitle>Días</SectionTitle>
        <ul className="divide-y divide-line">
          {days.map((d) => {
            const done = doneThisWeek(d.id);
            const isToday = d === todayDay;
            return (
              <li key={d.id}>
                <Link to={`/dia/${d.id}`} className="flex min-h-16 items-center gap-4 py-3 active:opacity-60">
                  <span className={`w-9 text-[13px] font-semibold uppercase ${isToday ? 'text-text' : 'text-muted'}`}>{weekdayName(weekdayOf(d), true)}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[16px] font-medium ${done ? 'text-muted' : ''}`}>{d.name}</span>
                    <span className="block text-[13px] text-muted">
                      {done ? `Hecho el ${formatLocalDate(done.localDate)}` : `${d.exercises.length} ejercicios`}
                    </span>
                  </span>
                  {done ? (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ok text-white" aria-label="Hecho esta semana">
                      <CheckIcon size={16} strokeWidth={3} />
                    </span>
                  ) : isToday ? (
                    <span className="rounded-full bg-text px-2.5 py-1 text-xs font-semibold text-bg">Hoy</span>
                  ) : (
                    <ChevronRightIcon className="text-faint" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-6">
        <SectionTitle
          action={
            sessions.length > 0 && (
              <Link to="/historial" className="inline-flex min-h-11 items-center text-sm font-medium text-muted">
                Ver todo
              </Link>
            )
          }
        >
          Historial
        </SectionTitle>
        {sessions.length === 0 ? (
          <p className="py-2 text-sm text-muted">Aquí aparecerán tus entrenamientos.</p>
        ) : (
          <ul className="divide-y divide-line">
            {sessions.slice(0, 3).map((s) => (
              <SessionRow key={s.id} session={s} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
