import type { Instant, LocalDate } from './types';

/**
 * Fechas civiles (`YYYY-MM-DD`) e instantes con zona IANA.
 *
 * Toda la aritmética de fechas civiles se hace con `Date.UTC`, de modo que nunca intervienen
 * la zona del dispositivo ni los cambios de horario. Para pasar de un instante a una fecha
 * civil se usa `Intl.DateTimeFormat` con la zona indicada.
 */

export const DEFAULT_TZ = 'America/Santiago';

const LOCAL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLocalDate(value: string): boolean {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1) return false;
  return d <= daysInMonth(y, mo);
}

export function parseLocalDate(value: LocalDate): { y: number; m: number; d: number } {
  const m = LOCAL_DATE_RE.exec(value);
  if (!m || !isLocalDate(value)) throw new Error(`Fecha local inválida: ${value}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function makeLocalDate(y: number, m: number, d: number): LocalDate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function toUtcDays(value: LocalDate): number {
  const { y, m, d } = parseLocalDate(value);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function fromUtcDays(days: number): LocalDate {
  const dt = new Date(days * 86_400_000);
  return makeLocalDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(value: LocalDate, n: number): LocalDate {
  return fromUtcDays(toUtcDays(value) + n);
}

export function addMonths(value: LocalDate, n: number): LocalDate {
  const { y, m, d } = parseLocalDate(value);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return makeLocalDate(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

/** Días entre `a` y `b` (b − a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return toUtcDays(b) - toUtcDays(a);
}

/** Día ISO de la semana: 1 = lunes … 7 = domingo. */
export function isoWeekday(value: LocalDate): number {
  const wd = new Date(toUtcDays(value) * 86_400_000).getUTCDay();
  return wd === 0 ? 7 : wd;
}

/** Lunes de la semana que contiene la fecha. */
export function startOfWeek(value: LocalDate): LocalDate {
  return addDays(value, 1 - isoWeekday(value));
}

export function startOfMonth(value: LocalDate): LocalDate {
  const { y, m } = parseLocalDate(value);
  return makeLocalDate(y, m, 1);
}

export function compareLocalDate(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function rangeDays(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Semanas (lunes) para una grilla mensual completa. */
export function monthGrid(value: LocalDate): LocalDate[][] {
  const first = startOfMonth(value);
  const { y, m } = parseLocalDate(first);
  const last = makeLocalDate(y, m, daysInMonth(y, m));
  const weeks: LocalDate[][] = [];
  for (let w = startOfWeek(first); w <= last; w = addDays(w, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(w, i)));
  }
  return weeks;
}

/* ---------- Instantes y zona ---------- */

const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

function zonedParts(instant: Date, timeZone: string) {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') };
}

/** Fecha civil de un instante en la zona dada. */
export function localDateOf(instant: Date | Instant, timeZone: string = DEFAULT_TZ): LocalDate {
  const dt = typeof instant === 'string' ? new Date(instant) : instant;
  const p = zonedParts(dt, timeZone);
  return makeLocalDate(p.y, p.m, p.d);
}

export function todayLocal(timeZone: string = DEFAULT_TZ, now: Date = new Date()): LocalDate {
  return localDateOf(now, timeZone);
}

/** Desfase en minutos de la zona respecto de UTC en ese instante (Santiago: −180 o −240). */
export function offsetMinutes(instant: Date | Instant, timeZone: string = DEFAULT_TZ): number {
  const dt = typeof instant === 'string' ? new Date(instant) : instant;
  const p = zonedParts(dt, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  const truncated = Math.floor(dt.getTime() / 1000) * 1000;
  return Math.round((asUtc - truncated) / 60_000);
}

/** ISO 8601 con desfase local explícito, p. ej. `2026-10-11T09:30:00-03:00`. */
export function formatInstantWithOffset(instant: Instant, timeZone: string = DEFAULT_TZ): string {
  const dt = new Date(instant);
  const p = zonedParts(dt, timeZone);
  const off = offsetMinutes(dt, timeZone);
  const sign = off < 0 ? '-' : '+';
  const abs = Math.abs(off);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${makeLocalDate(p.y, p.m, p.d)}T${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/* ---------- Presentación ---------- */

const WEEKDAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const WEEKDAYS_SHORT = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function weekdayName(isoDay: number, short = false): string {
  return (short ? WEEKDAYS_SHORT : WEEKDAYS_LONG)[isoDay - 1] ?? '';
}

export function monthName(m: number, short = false): string {
  return (short ? MONTHS_SHORT : MONTHS)[m - 1] ?? '';
}

/** "lunes 13 oct" o "lunes 13 de octubre de 2026". */
export function formatLocalDate(value: LocalDate, style: 'short' | 'long' | 'compact' = 'short'): string {
  const { y, m, d } = parseLocalDate(value);
  const wd = weekdayName(isoWeekday(value), style === 'compact');
  if (style === 'long') return `${wd} ${d} de ${monthName(m)} de ${y}`;
  if (style === 'compact') return `${wd} ${d} ${monthName(m, true)}`;
  return `${wd} ${d} ${monthName(m, true)}`;
}

export function formatTimeOfDay(instant: Instant, timeZone: string = DEFAULT_TZ): string {
  const p = zonedParts(new Date(instant), timeZone);
  return `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
}

export function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
