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
  const doneThisWeek = (dayId: string) => {
    const records = sessions.filter((s) => s.programId === program.id && s.dayId === dayId && s.localDate >= weekStart && s.localDate <= weekEnd);
    return records.find((s) => s.status === 'completed') ?? records[0];
  };
  const todayDay = days.find((d) => weekdayOf(d) === isoWeekday(today));
  const nextDay = days.find((d) => weekdayOf(d) > isoWeekday(today) && !doneThisWeek(d.id)) ?? days.find((d) => !doneThisWeek(d.id));
  const week = plan.week !== null && plan.week >= 1 ? plan.week : null;
  const periodEnded = week !== null && week > program.weeks;
  const completedDays = days.filter((d) => doneThisWeek(d.id)?.status === 'completed').length;

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

  async function decideAdaptation(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); }
    catch (e) { toast({ message: userMessage(e), tone: 'error' }); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex items-start justify-between gap-2 pb-5 pt-5">
        <div>
          <p className="mb-3 flex items-center gap-2 text-[12px] font-bold tracking-[0.2em] text-accent">
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="h-7 w-7 rounded-lg" />
            ATLAS
          </p>
          <p className="text-sm text-muted first-letter:uppercase">{longDate(today)}</p>
          <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">Mi rutina</h1>
          {periodEnded ? (
            <p className="mt-1 text-sm text-muted">Período de {program.weeks} semanas finalizado</p>
          ) : week ? (
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
        <section className="training-hero rounded-3xl p-5 text-white">
          <p className="text-[13px] font-semibold uppercase tracking-wider opacity-90">En curso</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">{active.title}</p>
          {progress && (
            <p className="mt-1 text-sm opacity-90 tabular">
              {progress.done} de {progress.expected} series
            </p>
          )}
          <Button size="lg" variant="inverse" className="mt-5 w-full" onClick={() => navigate('/sesion')}>
            Continuar
          </Button>
        </section>
      ) : todayDay && !doneThisWeek(todayDay.id) && !periodEnded && week ? (
        <section className="training-hero rounded-3xl p-5 text-white">
          <p className="text-[13px] font-semibold uppercase tracking-wider opacity-90">Hoy</p>
          <Link to={`/dia/${todayDay.id}`} className="mt-1 flex min-h-11 items-center justify-between gap-2">
            <span className="text-2xl font-bold tracking-tight">{todayDay.name}</span>
            <ChevronRightIcon className="opacity-60" />
          </Link>
          <p className="mt-1 text-sm opacity-90">
            {todayDay.exercises.length} ejercicios · ~{dayMinutes(todayDay)} min
          </p>
          <Button size="lg" variant="inverse" busy={busy} className="mt-5 w-full" onClick={() => start(todayDay.id)}>
            Empezar
          </Button>
        </section>
      ) : (
        <section className="rounded-3xl border border-line bg-surface p-5">
          <p className="text-[13px] font-semibold uppercase tracking-wider text-muted">Hoy</p>
          <p className="mt-1 text-2xl font-bold tracking-tight">
            {periodEnded ? 'Tu rutina sigue disponible' : todayDay && doneThisWeek(todayDay.id) ? (doneThisWeek(todayDay.id)?.status === 'partial' ? 'Sesión parcial guardada' : 'Hecho') : 'Descanso'}
          </p>
          {periodEnded ? (
            <p className="mt-2 text-sm text-muted">Terminó el calendario inicial. Revisa tu historial y el siguiente paso con un entrenador.</p>
          ) : nextDay && (
            <p className="mt-1 text-sm text-muted">
              Próximo: <span className="first-letter:uppercase">{weekdayName(weekdayOf(nextDay))}</span> · {nextDay.name}
            </p>
          )}
        </section>
      )}

      {plan.adaptation?.pendingDecision && !active && (
        <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <p className="text-[15px] font-medium">{plan.adaptation.active ? '¿Pasar a las series completas?' : '¿Volver una semana a la adaptación?'}</p>
          <p className="mt-1 text-sm text-muted">{plan.adaptation.reason}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="primary" busy={busy} onClick={() => decideAdaptation(() => plan.adaptation!.active ? endAdaptation(program) : keepAdaptation(program, today))}>
              Sí
            </Button>
            <Button size="sm" disabled={busy} onClick={() => decideAdaptation(() => plan.adaptation!.active ? keepAdaptation(program, today) : endAdaptation(program))}>
              Todavía no
            </Button>
          </div>
        </section>
      )}

      <section className="mt-6">
        <SectionTitle action={<span className="text-xs text-muted tabular">{completedDays}/{days.length} completas esta semana</span>}>Días</SectionTitle>
        <ul className="app-list divide-y divide-line">
          {days.map((d) => {
            const done = doneThisWeek(d.id);
            const isToday = d === todayDay;
            return (
              <li key={d.id}>
                <Link to={`/dia/${d.id}`} className={`flex min-h-20 items-center gap-3 px-3 py-3 active:bg-surface-2 ${isToday ? 'bg-accent/5' : ''}`}>
                  <span className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl text-[12px] font-bold uppercase ${isToday ? 'bg-accent text-white' : 'bg-surface-2 text-muted'}`}>{weekdayName(weekdayOf(d), true)}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[16px] font-medium ${done ? 'text-muted' : ''}`}>{d.name}</span>
                    <span className="block text-[13px] text-muted">
                      {done ? `${done.status === 'partial' ? 'Parcial' : 'Hecho'} el ${formatLocalDate(done.localDate)}` : `${d.exercises.length} ejercicios · ~${dayMinutes(d)} min`}
                    </span>
                  </span>
                  {done?.status === 'completed' ? (
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ok text-white" aria-label="Hecho esta semana">
                      <CheckIcon size={16} strokeWidth={3} />
                    </span>
                  ) : done?.status === 'partial' ? (
                    <span className="rounded-full bg-warn/10 px-2.5 py-1 text-xs font-semibold text-warn" aria-label="Parcial esta semana">Parcial</span>
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
          <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Aquí aparecerán tus entrenamientos. Empieza por uno de los días de tu rutina.</p>
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
