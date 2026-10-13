import { Link } from 'react-router';
import { formatLocalDate, isoWeekday, monthName, parseLocalDate, weekdayName } from '../domain/dates';
import { sessionActiveMs } from '../domain/timer';
import type { LoadUnit, Prescription, RoutineDay, SetLog, VariantSnapshot, WorkoutSession } from '../domain/types';
import { formatDecimal } from '../domain/validation';
import { ChevronRightIcon } from '../ui/icons';

/** Piezas de presentación compartidas por las pantallas simples. */

/** "domingo 11 de octubre". */
export function longDate(date: string): string {
  const { m, d } = parseLocalDate(date);
  return `${weekdayName(isoWeekday(date))} ${d} de ${monthName(m)}`;
}

export function dayMinutes(day: RoutineDay): number {
  const t = day.timeSplit;
  return t.warmupMin + t.strengthMin + t.cardioMin + t.cooldownMin;
}

/** "3 × 8–12" o "2 × 20–30 s", con "por lado" si corresponde. */
export function targetText(p: Prescription, measure: VariantSnapshot['measure'] = 'reps'): string {
  if (measure === 'time') return `${p.sets} × ${p.durationMin ?? '?'}–${p.durationMax ?? '?'} s`;
  const reps = p.repMin === p.repMax ? `${p.repMin}` : `${p.repMin}–${p.repMax}`;
  return `${p.sets} × ${reps}${p.repsMode === 'per-side' ? ' por lado' : ''}`;
}

/** Etiqueta corta de la columna de carga. */
export function loadColumn(v: Pick<VariantSnapshot, 'loadConvention' | 'implements'>, unit: LoadUnit): string {
  if (v.loadConvention === 'per-implement' && v.implements === 2) return `${unit} c/u`;
  return unit;
}

/** "40 × 12" (o "45 s"), con el lado si aplica. */
export function setText(s: Pick<SetLog, 'load' | 'reps' | 'durationSec' | 'side'>): string {
  const work = s.reps !== null ? `${s.reps}` : s.durationSec !== null ? `${s.durationSec} s` : '—';
  const side = s.side === 'left' ? ' izq.' : s.side === 'right' ? ' der.' : '';
  return s.load === null ? `${work}${side}` : `${formatDecimal(s.load)} × ${work}${side}`;
}

/** Sugiere subir peso si en la última sesión todas las series llegaron al tope de repeticiones. */
export function reachedTop(sets: Pick<SetLog, 'reps'>[], repMax: number): boolean {
  return sets.length > 0 && sets.every((s) => s.reps !== null && s.reps >= repMax);
}

/** Duración activa redondeada: "52 min" o "1 h 05 min". */
export function sessionMinutes(s: WorkoutSession, now = Date.now()): string {
  const min = Math.round(sessionActiveMs(s.startedAt, s.endedAt, s.pauses, now) / 60_000);
  return min >= 60 ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
}

export function SessionRow({ session }: { session: WorkoutSession }) {
  return (
    <li>
      <Link to={`/historial/${session.id}`} className="flex min-h-16 items-center gap-4 py-3 active:opacity-60">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium">{session.title}</span>
          <span className="block text-[13px] text-muted first-letter:uppercase">
            {formatLocalDate(session.localDate)} · {sessionMinutes(session)}
            {session.status === 'partial' ? ' · parcial' : ''}
          </span>
        </span>
        <ChevronRightIcon className="text-faint" />
      </Link>
    </li>
  );
}
