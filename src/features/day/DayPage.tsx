import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useActiveSession, useTimeZone, useToday } from '../../app/hooks';
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
  if (!template || !day || !plan.sequence) {
    return (
      <>
        <PageHeader back="/" />
        <p className="py-10 text-muted">Este día ya no está en la rutina.</p>
      </>
    );
  }

  const adaptation = plan.adaptation?.active ?? true;
  const dayNumber = template.days.findIndex((d) => d.id === day.id) + 1;
  const sequence = plan.sequence;
  const isNext = sequence.nextDayId === day.id;

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
      <PageHeader back="/" subtitle="Tu entrenamiento" />
      <p className="text-[13px] font-semibold uppercase tracking-wider text-muted">Día {dayNumber}</p>
      <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight">{day.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {day.exercises.length} ejercicios · ~{dayMinutes(day)} min{adaptation ? ' · adaptación' : ''}
      </p>

      <section className="mt-4 rounded-2xl border border-line bg-surface p-4" aria-label="Distribución orientativa de la sesión">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Tu sesión · tiempos orientativos</p>
        <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 text-sm min-[380px]:grid-cols-2">
          {[
            ['Calentamiento', day.timeSplit.warmupMin],
            ['Fuerza', day.timeSplit.strengthMin],
            ['Cardio', day.timeSplit.cardioMin],
            ['Cierre', day.timeSplit.cooldownMin],
          ].map(([label, min]) => (
            <div key={label} className="flex items-center justify-between gap-2">
              <dt className="text-muted">{label}</dt>
              <dd className="font-semibold tabular">{min} min</dd>
            </div>
          ))}
        </dl>
      </section>
      {adaptation && <p className="mt-3 text-sm text-muted">Adaptación: hasta {template.adaptation.setsPerExercise} series de trabajo por ejercicio.</p>}
      <p className="mt-2 text-sm text-muted">Toca un ejercicio para ver su técnica y demostración.</p>

      <ol className="app-list mt-3 flex-1 divide-y divide-line">
        {day.exercises.map((ex, i) => {
          const v = variants[i];
          const p = effectivePrescription(ex, adaptation, template);
          const best = bestSet(last?.get(ex.variantId)?.sets ?? []);
          return (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => setTech(ex.variantId)}
                className="flex min-h-20 w-full items-center gap-3 px-3 py-3.5 text-left active:bg-surface-2"
                aria-label={`${v?.name ?? 'Ejercicio'}: ver técnica`}
              >
                <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-muted tabular">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-medium leading-snug">{v?.name ?? '…'}</span>
                  <span className="mt-0.5 block text-[13px] text-muted tabular">
                    {targetText(p, v?.measure)} · {ex.restSec} s{best ? ` · último registro ${setText(best, best.unit)}` : ''}
                  </span>
                  <span className="mt-1 block text-xs text-muted">RIR {p.rirMin}–{p.rirMax}</span>
                  <span className="mt-1 block text-xs font-medium text-accent">{ex.alternativeVariantIds.length} alternativa{ex.alternativeVariantIds.length === 1 ? '' : 's'} al entrenar</span>
                </span>
                <InfoIcon className="text-faint" />
              </button>
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-muted">RIR = repeticiones que podrías hacer antes del fallo. La rutina y técnica siguen pendientes de revisión profesional.</p>
      <details className="mt-3 rounded-2xl border border-line bg-surface px-4">
        <summary className="flex min-h-12 items-center text-sm font-medium text-accent">Carga y esfuerzo</summary>
        <p className="pb-4 text-sm text-muted">No hay un peso inicial calculado. Mantén la carga hasta completar todas las series en el tope del rango con técnica y RIR correctos. Considera después el menor incremento disponible. No aumentes con dolor, técnica deteriorada o una sesión incompleta. Las cargas de máquinas distintas no son directamente comparables.</p>
      </details>
      <details className="mt-3 rounded-2xl border border-line bg-surface px-4">
        <summary className="flex min-h-12 items-center text-sm font-medium text-accent">Calentamiento, cardio y alternativas</summary>
        <div className="space-y-3 pb-4 text-sm text-muted">
          <p>Antes de la fuerza, muévete suave y practica el primer ejercicio con series ligeras de aproximación. No cuentan como series de trabajo. Pide ayuda con los ajustes de la máquina al comenzar.</p>
          <p>Después de la fuerza, haz unos {day.timeSplit.cardioMin} minutos de caminadora, bicicleta o elíptica según disponibilidad. Usa una intensidad que permita conversar, pero no cantar. Estos bloques son un inicio; aumenta gradualmente tu actividad semanal.</p>
          <p>Si falta un equipo o está ocupado, toca Cambiar en la sesión. Algunas opciones usan otro movimiento: revisa su técnica y empieza con una carga propia. Los equipos específicos de la sede siguen por verificar.</p>
          <p>Los descansos son un punto de partida. Si falta recuperación, amplíalos; no aceleres las repeticiones para cerrar la hora exacta.</p>
        </div>
      </details>

      <div className="sticky bottom-0 -mx-4 mt-4 bg-bg/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        {active ? (
          <Button variant="primary" size="lg" className="w-full" onClick={() => navigate('/sesion')}>
            {active.dayId === day.id ? 'Continuar' : `Continuar «${active.title}»`}
          </Button>
        ) : isNext ? (
          <Button variant="primary" size="lg" className="w-full" busy={busy} onClick={start}>
            Empezar
          </Button>
        ) : sequence.nextDayId ? (
          <>
            <p className="mb-2 text-center text-sm text-muted">Completa el Día {sequence.nextDayNumber} para avanzar.</p>
            <Button variant="secondary" size="lg" className="w-full" onClick={() => navigate(`/dia/${sequence.nextDayId}`)}>
              Ver Día {sequence.nextDayNumber} pendiente
            </Button>
          </>
        ) : (
          <p className="py-3 text-center text-sm text-muted">No hay un día pendiente.</p>
        )}
      </div>

      <TechniqueSheet variantId={tech} onClose={() => setTech(null)} />
    </div>
  );
}
