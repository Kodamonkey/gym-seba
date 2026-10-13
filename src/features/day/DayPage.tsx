import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useActiveSession, useTimeZone, useToday } from '../../app/hooks';
import { weekdayName } from '../../domain/dates';
import { effectivePrescription } from '../../domain/schedule';
import type { SetLog } from '../../domain/types';
import { db, userMessage } from '../../data/db';
import { lastPerformanceByVariant, startDay } from '../../data/overview';
import { ActiveSessionExistsError } from '../../data/sessions';
import { InfoIcon } from '../../ui/icons';
import { Button, Loading, PageHeader } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { TechniqueSheet } from '../exercise/TechniqueSheet';
import { usePlan } from '../plan';
import { dayMinutes, setText, targetText } from '../shared';

/** La serie más pesada (y con más repeticiones) de la última vez. */
function bestSet(sets: SetLog[]): SetLog | undefined {
  return [...sets].sort((a, b) => (b.load ?? 0) - (a.load ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
}

/** Un día de la rutina: sus ejercicios, lo que hiciste la última vez y el botón para empezar. */
export function DayPage() {
  const { dayId = '' } = useParams();
  const today = useToday();
  const tz = useTimeZone();
  const plan = usePlan(today);
  const active = useActiveSession();
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [tech, setTech] = useState<string | null>(null);

  const template = plan?.template;
  const day = template?.days.find((d) => d.id === dayId);
  const ids = day?.exercises.map((e) => e.variantId) ?? [];
  const variants = useLiveQuery(() => db.variants.bulkGet(ids), [ids.join()]);
  const last = useLiveQuery(() => lastPerformanceByVariant(ids), [ids.join()]);

  if (!plan || active === undefined || !variants) return <Loading />;
  if (!template || !day) {
    return (
      <>
        <PageHeader back="/" />
        <p className="py-10 text-muted">Este día ya no está en la rutina.</p>
      </>
    );
  }

  const adaptation = plan.adaptation?.active ?? true;
  const weekday = plan.program?.weekdays[day.id] ?? day.weekday;

  async function start() {
    setBusy(true);
    try {
      await startDay(day!.id, tz);
      navigate('/sesion');
    } catch (e) {
      if (e instanceof ActiveSessionExistsError) navigate('/sesion');
      else toast({ message: userMessage(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader back="/" />
      <p className="text-[13px] font-semibold uppercase tracking-wider text-muted">{weekdayName(weekday)}</p>
      <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">{day.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {day.exercises.length} ejercicios · ~{dayMinutes(day)} min{adaptation ? ' · adaptación' : ''}
      </p>

      <ol className="mt-4 flex-1 divide-y divide-line">
        {day.exercises.map((ex, i) => {
          const v = variants[i];
          const p = effectivePrescription(ex, adaptation, template);
          const best = bestSet(last?.get(ex.variantId)?.sets ?? []);
          return (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => setTech(ex.variantId)}
                className="flex min-h-16 w-full items-center gap-4 py-3.5 text-left active:opacity-60"
                aria-label={`${v?.name ?? 'Ejercicio'}: ver técnica`}
              >
                <span className="w-5 text-[15px] font-semibold text-faint tabular">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium leading-snug">{v?.name ?? '…'}</span>
                  <span className="mt-0.5 block text-[13px] text-muted tabular">
                    {targetText(p, v?.measure)} · {ex.restSec} s{best ? ` · última ${setText(best)}` : ''}
                  </span>
                </span>
                <InfoIcon className="text-faint" />
              </button>
            </li>
          );
        })}
      </ol>

      <div className="sticky bottom-0 -mx-4 mt-4 bg-bg/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {active && active.dayId !== day.id ? (
          <Button variant="secondary" size="lg" className="w-full" onClick={() => navigate('/sesion')}>
            Tienes «{active.title}» en curso
          </Button>
        ) : (
          <Button variant="primary" size="lg" className="w-full" busy={busy} onClick={() => (active ? navigate('/sesion') : start())}>
            {active ? 'Continuar' : 'Empezar'}
          </Button>
        )}
      </div>

      <TechniqueSheet variantId={tech} onClose={() => setTech(null)} />
    </div>
  );
}
