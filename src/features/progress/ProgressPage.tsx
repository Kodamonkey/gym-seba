import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useToday } from '../../app/hooks';
import { addDays, formatDuration, formatLocalDate, startOfWeek } from '../../domain/dates';
import { comparisonKeyOf } from '../../domain/load';
import { computePRs, PR_LABEL, PR_STATUS_LABEL, type PREntry } from '../../domain/pr';
import { compliance, COMPLIANCE_DEFINITION } from '../../domain/schedule';
import { sessionActiveMs, totalPausedMs } from '../../domain/timer';
import type { LocalDate } from '../../domain/types';
import { formatDecimal, parseDecimal } from '../../domain/validation';
import { db, nowIso, uid, userMessage } from '../../data/db';
import { prEntries } from '../../data/sessions';
import { MUSCLE_BY_ID } from '../../data/seed/muscles';
import { BarChart, LineChart } from '../../ui/charts';
import { Button, Card, EmptyState, Field, Loading, Select, SectionTitle } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { usePlan } from '../plan';

const PERIODS = [
  { value: '4', label: 'Últimas 4 semanas' },
  { value: '8', label: 'Últimas 8 semanas' },
  { value: '12', label: 'Últimas 12 semanas' },
  { value: 'all', label: 'Todo' },
];

const loadUnit = (t: string) => (t === 'max-load' ? 'kg' : t === 'max-duration' ? 's' : t === 'reps-at-load' ? 'rep' : 'kg·rep');

export function ProgressPage() {
  const today = useToday();
  const plan = usePlan(today);
  const toast = useToast();
  const [period, setPeriod] = useState('8');
  const [keySel, setKeySel] = useState('');
  const data = useLiveQuery(async () => {
    const [ses, sets, equipment, measurements, cardio, entries, variants] = await Promise.all([
      db.sessionExercises.toArray(),
      db.setLogs.toArray(),
      db.equipment.toArray(),
      db.bodyMeasurements.toArray(),
      db.cardioLogs.toArray(),
      prEntries(),
      db.variants.toArray(),
    ]);
    return { ses, sets, equipment, measurements, cardio, entries, variants };
  }, []);

  const from: LocalDate | null = period === 'all' ? null : addDays(today, -7 * Number(period) + 1);
  const inPeriod = (d: LocalDate) => !from || d >= from;

  const derived = useMemo(() => {
    if (!data || !plan) return null;
    const sessionById = new Map(plan.sessions.map((s) => [s.id, s]));
    const prs = computePRs(data.entries);
    const eqName = new Map(data.equipment.map((e) => [e.id, e.name]));
    // Contextos comparables presentes en los datos.
    const keys = new Map<string, { label: string; confirmed: boolean }>();
    for (const se of data.ses) {
      const k = comparisonKeyOf(se);
      if (!data.entries.some((e) => e.key === k.key)) continue;
      const eq = se.variant.requiresEquipmentInstance ? (se.equipmentInstanceId ? (eqName.get(se.equipmentInstanceId) ?? 'máquina') : 'máquina sin identificar') : 'peso libre';
      keys.set(k.key, { label: `${se.variant.name} · ${eq}`, confirmed: k.confirmed });
    }
    return { prs, keys, sessionById };
  }, [data, plan]);

  if (!data || !plan || !derived) return <Loading />;
  const { prs, keys, sessionById } = derived;

  const done = plan.sessions.filter((s) => (s.status === 'completed' || s.status === 'partial') && inPeriod(s.localDate));
  const firstDate = [plan.program?.startDate, ...plan.sessions.map((s) => s.localDate)].filter(Boolean).sort()[0] as LocalDate | undefined;

  // Sesiones por semana desde el inicio (o el período), sin inventar semanas previas.
  const weeks: { label: string; value: number; start: LocalDate }[] = [];
  if (firstDate) {
    let w = startOfWeek(from && from > firstDate ? from : firstDate);
    const end = startOfWeek(today);
    while (w <= end) {
      const e = addDays(w, 6);
      weeks.push({ start: w, label: formatLocalDate(w, 'compact').replace(/^\S+ /, ''), value: done.filter((s) => s.localDate >= w && s.localDate <= e).length });
      w = addDays(w, 7);
    }
  }
  const comp = compliance(
    plan.items.filter((i) => inPeriod(i.sw.date)).map((i) => ({ date: i.sw.date, status: i.status })),
    today,
  );

  const selected = keySel && keys.has(keySel) ? keySel : ([...keys.keys()][0] ?? '');
  const keyEntries = data.entries.filter((e) => e.key === selected && inPeriod(e.date));
  const bySession = new Map<string, PREntry[]>();
  for (const e of keyEntries) bySession.set(e.sessionId, [...(bySession.get(e.sessionId) ?? []), e]);
  const sessionPoints = [...bySession.entries()]
    .map(([sid, es]) => ({ s: sessionById.get(sid), es }))
    .filter((x) => x.s)
    .sort((a, b) => (a.s!.startedAt < b.s!.startedAt ? -1 : 1));
  const loadPoints = sessionPoints.map(({ s, es }) => {
    const loads = es.map((e) => e.loadKg).filter((v): v is number => v !== null);
    const best = loads.length ? Math.max(...loads) : null;
    const repsAtBest = es.filter((e) => e.loadKg === best).map((e) => e.reps ?? 0);
    return { label: formatLocalDate(s!.localDate, 'compact'), value: best, detail: best !== null ? `${Math.max(...repsAtBest)} rep` : undefined, href: `/historial/${s!.id}` };
  });
  const volPoints = sessionPoints.map(({ s, es }) => ({
    label: formatLocalDate(s!.localDate, 'compact'),
    value: es.some((e) => e.volumeKg !== null) ? es.reduce((a, e) => a + (e.volumeKg ?? 0), 0) : null,
    href: `/historial/${s!.id}`,
  }));
  const durPoints = sessionPoints.map(({ s, es }) => ({
    label: formatLocalDate(s!.localDate, 'compact'),
    value: es.some((e) => e.durationSec !== null) ? Math.max(...es.map((e) => e.durationSec ?? 0)) : null,
  }));

  const recentNew = prs.events.filter((e) => e.status === 'new' && e.type !== 'reps-at-load' && inPeriod(e.date)).slice(-8).reverse();

  // Resumen muscular de la semana: series de trabajo confirmadas donde el músculo es objetivo.
  const weekStart = startOfWeek(today);
  const weekSessions = new Set(plan.sessions.filter((s) => s.localDate >= weekStart && s.status !== 'discarded').map((s) => s.id));
  const variantById = new Map(data.variants.map((v) => [v.id, v]));
  const muscleSets = new Map<string, number>();
  for (const set of data.sets) {
    if (!weekSessions.has(set.sessionId) || set.status !== 'completed' || set.kind !== 'work' || set.deletedAt) continue;
    const se = data.ses.find((x) => x.id === set.sessionExerciseId);
    const v = se ? variantById.get(se.variantId) : undefined;
    for (const m of v?.muscles ?? []) if (m.role === 'target') muscleSets.set(m.muscleId, (muscleSets.get(m.muscleId) ?? 0) + 1);
  }

  const durations = done
    .filter((s) => s.endedAt)
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 8);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Progreso</h1>
        <Select label="Período" value={period} onChange={setPeriod} options={PERIODS} />
      </div>

      <section>
        <SectionTitle>Constancia</SectionTitle>
        <Card className="flex flex-col gap-3">
          {weeks.length ? (
            <BarChart title="Sesiones registradas por semana" points={weeks.map((w) => ({ label: w.label, value: w.value }))} unit="sesiones" integer tableHeader={['Semana (lunes)', 'Sesiones']} />
          ) : (
            <p className="text-sm text-muted">Aún no hay semanas con programa o sesiones.</p>
          )}
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Stat label="Cumplimiento" value={comp.ratio === null ? 'sin datos' : `${Math.round(comp.ratio * 100)} %`} />
            <Stat label="Completadas" value={`${comp.completed} de ${comp.due}`} />
            <Stat label="Parciales" value={String(comp.partial)} />
            <Stat label="Omitidas / sin registrar" value={`${comp.skipped} / ${comp.unclassified}`} />
          </div>
          <p className="text-xs text-faint">{COMPLIANCE_DEFINITION}</p>
        </Card>
      </section>

      <section>
        <SectionTitle>Rendimiento por ejercicio</SectionTitle>
        {keys.size === 0 ? (
          <EmptyState title="Aún no hay series confirmadas">Registra tu primera sesión para ver la evolución.</EmptyState>
        ) : (
          <Card className="flex flex-col gap-4">
            <Select
              label="Ejercicio y equipo (contexto comparable)"
              value={selected}
              onChange={setKeySel}
              options={[...keys.entries()].map(([k, v]) => ({ value: k, label: `${v.label}${v.confirmed ? '' : ' — comparabilidad no confirmada'}` }))}
            />
            {keyEntries.length === 0 ? (
              <p className="text-sm text-muted">Sin registros de este contexto en el período.</p>
            ) : (
              <>
                {loadPoints.some((p) => p.value !== null) && <LineChart title="Mayor carga registrada por sesión" points={loadPoints} unit="kg" />}
                {volPoints.some((p) => p.value !== null) && <LineChart title="Volumen registrado por sesión" points={volPoints} unit="kg·rep" />}
                {durPoints.some((p) => p.value !== null) && <LineChart title="Mayor duración por sesión" points={durPoints} unit="s" />}
              </>
            )}
            <div>
              <h3 className="mb-1 font-semibold">Récords vigentes de este contexto</h3>
              <ul className="text-sm">
                {prs.bests
                  .filter((b) => b.key === selected && b.type !== 'reps-at-load')
                  .map((b) => (
                    <li key={b.type} className="flex justify-between gap-2">
                      <span>{PR_LABEL[b.type]}</span>
                      <Link to={`/historial/${b.sessionId}`} className="tabular text-accent underline">
                        {formatDecimal(Math.round(b.value * 10) / 10)} {loadUnit(b.type)} · {formatLocalDate(b.date)}
                      </Link>
                    </li>
                  ))}
              </ul>
            </div>
            <p className="text-xs text-faint">
              Volumen registrado = carga normalizada × repeticiones válidas de series de trabajo (sin calentamientos). No es trabajo mecánico ni calorías, y no se suma entre
              máquinas distintas. Las sesiones sin datos no se dibujan como cero.
            </p>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle>Mejoras recientes</SectionTitle>
        <Card>
          {recentNew.length === 0 ? (
            <p className="text-sm text-muted">Sin nuevos récords en el período.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {recentNew.map((e) => (
                <li key={`${e.setId}-${e.type}`} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {PR_STATUS_LABEL[e.status]} · {PR_LABEL[e.type]} · {keys.get(e.key)?.label ?? '—'}
                  </span>
                  <Link to={`/historial/${e.sessionId}`} className="tabular text-accent underline">
                    {formatDecimal(Math.round(e.value * 10) / 10)} {loadUnit(e.type)}
                    {e.previous !== null ? ` (antes ${formatDecimal(Math.round(e.previous * 10) / 10)})` : ''}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <section>
        <SectionTitle>Series por músculo objetivo esta semana</SectionTitle>
        <Card>
          {muscleSets.size === 0 ? (
            <p className="text-sm text-muted">Sin series de trabajo confirmadas esta semana.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-1 text-sm">
              {[...muscleSets.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([m, n]) => (
                  <li key={m} className="flex justify-between gap-2 border-b border-line/50 py-1">
                    <span>{MUSCLE_BY_ID.get(m)?.commonName ?? m}</span>
                    <span className="tabular">{n}</span>
                  </li>
                ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-faint">
            Regla: cuenta 1 por cada serie de trabajo confirmada en la que el músculo figura como objetivo de la variante. No mide activación, fatiga ni recuperación, y no suma
            series indirectas.
          </p>
        </Card>
      </section>

      <section>
        <SectionTitle>Duración de las sesiones</SectionTitle>
        <Card>
          {durations.length === 0 ? (
            <p className="text-sm text-muted">Sin sesiones finalizadas en el período.</p>
          ) : (
            <ul className="text-sm tabular">
              {durations.map((s) => (
                <li key={s.id} className="flex justify-between gap-2 border-b border-line/50 py-1">
                  <Link to={`/historial/${s.id}`} className="underline-offset-2 hover:underline">
                    {formatLocalDate(s.localDate, 'compact')} · {s.title}
                  </Link>
                  <span>
                    {formatDuration(sessionActiveMs(s.startedAt, s.endedAt, s.pauses, Date.parse(s.endedAt!)))} activo
                    {totalPausedMs(s.pauses, Date.parse(s.endedAt!)) > 0 && ` · ${formatDuration(totalPausedMs(s.pauses, Date.parse(s.endedAt!)))} en pausa`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Measurements measurements={data.measurements} inPeriod={inPeriod} today={today} onError={(m) => toast({ message: m, tone: 'error' })} />
      <Cardio logs={data.cardio} inPeriod={inPeriod} today={today} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 p-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-lg font-semibold tabular">{value}</p>
    </div>
  );
}

function Measurements({
  measurements,
  inPeriod,
  today,
  onError,
}: {
  measurements: { id: string; date: string; weightKg: number | null; waistCm: number | null; notes: string }[];
  inPeriod: (d: string) => boolean;
  today: string;
  onError: (m: string) => void;
}) {
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [w, setW] = useState('');
  const [waist, setWaist] = useState('');
  const list = measurements.filter((m) => inPeriod(m.date)).sort((a, b) => (a.date < b.date ? -1 : 1));

  async function add() {
    const pw = parseDecimal(w, 'El peso');
    const pc = parseDecimal(waist, 'La cintura');
    if (!pw.ok || !pc.ok) return onError(!pw.ok ? pw.error : !pc.ok ? pc.error : '');
    if (pw.value === null && pc.value === null) return onError('Ingresa peso o cintura.');
    if (date > today) return onError('La fecha no puede ser futura.');
    const now = nowIso();
    try {
      await db.bodyMeasurements.add({ id: uid(), date, weightKg: pw.value, waistCm: pc.value, notes: '', createdAt: now, updatedAt: now });
      setW('');
      setWaist('');
      toast({ message: 'Medición guardada.', tone: 'ok' });
    } catch (e) {
      onError(userMessage(e));
    }
  }

  return (
    <section>
      <SectionTitle>Peso y cintura</SectionTitle>
      <Card className="flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label="Fecha" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          <Field label="Peso" suffix="kg" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
          <Field label="Cintura" suffix="cm" inputMode="decimal" value={waist} onChange={(e) => setWaist(e.target.value)} />
        </div>
        <Button onClick={add}>Guardar medición</Button>
        {list.some((m) => m.weightKg !== null) && (
          <LineChart title="Peso" unit="kg" points={list.filter((m) => m.weightKg !== null).map((m) => ({ label: formatLocalDate(m.date, 'compact'), value: m.weightKg }))} />
        )}
        {list.some((m) => m.waistCm !== null) && (
          <LineChart title="Cintura" unit="cm" points={list.filter((m) => m.waistCm !== null).map((m) => ({ label: formatLocalDate(m.date, 'compact'), value: m.waistCm }))} />
        )}
        {list.length > 0 && (
          <ul className="text-sm tabular">
            {[...list].reverse().map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 border-b border-line/50 py-1">
                <span>{formatLocalDate(m.date)}</span>
                <span>
                  {m.weightKg !== null ? `${formatDecimal(m.weightKg)} kg` : '—'} · {m.waistCm !== null ? `${formatDecimal(m.waistCm)} cm` : '—'}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    const copy = await db.bodyMeasurements.get(m.id);
                    await db.bodyMeasurements.delete(m.id);
                    toast({ message: 'Medición eliminada.', tone: 'ok', action: { label: 'Deshacer', run: () => void (copy && db.bodyMeasurements.add(copy)) } });
                  }}
                  aria-label={`Eliminar medición del ${formatLocalDate(m.date)}`}
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-faint">Solo tus mediciones. ATLAS no calcula metas, grasa corporal ni progreso estético a partir de ellas.</p>
      </Card>
    </section>
  );
}

function Cardio({ logs, inPeriod, today }: { logs: { id: string; date: string; modality: string; durationMin: number; distanceKm: number | null; rpe: number | null }[]; inPeriod: (d: string) => boolean; today: string }) {
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [type, setType] = useState('Cinta');
  const [min, setMin] = useState('');
  const [km, setKm] = useState('');
  const [rpe, setRpe] = useState('');
  const list = logs.filter((l) => inPeriod(l.date)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const total = list.reduce((a, l) => a + l.durationMin, 0);
  return (
    <section>
      <SectionTitle>Cardio</SectionTitle>
      <Card className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Field label="Fecha" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          <Field label="Tipo" value={type} onChange={(e) => setType(e.target.value)} />
          <Field label="Minutos" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
          <Field label="Km (opcional)" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
          <Field label="Esfuerzo 1–10 (opcional)" inputMode="numeric" value={rpe} onChange={(e) => setRpe(e.target.value)} />
        </div>
        <Button
          onClick={async () => {
            const m = parseDecimal(min, 'Los minutos');
            const k = parseDecimal(km, 'La distancia');
            const r = parseDecimal(rpe, 'El esfuerzo');
            if (!m.ok || !k.ok || !r.ok || m.value === null || m.value <= 0 || (r.ok && r.value !== null && (r.value < 1 || r.value > 10))) {
              toast({ message: 'Revisa minutos (> 0), distancia y esfuerzo (1–10).', tone: 'error' });
              return;
            }
            const now = nowIso();
            await db.cardioLogs.add({ id: uid(), date, sessionId: null, modality: type, durationMin: m.value, distanceKm: k.value, rpe: r.value, notes: '', createdAt: now, updatedAt: now });
            setMin('');
            setKm('');
            setRpe('');
            toast({ message: 'Cardio guardado.', tone: 'ok' });
          }}
        >
          Guardar cardio
        </Button>
        <p className="text-sm text-muted">
          Total en el período: <strong className="tabular">{formatDecimal(Math.round(total))} min</strong> en {list.length} registros. Las sesiones de cardio no suman volumen de carga.
        </p>
        <ul className="text-sm tabular">
          {list.slice(0, 12).map((l) => (
            <li key={l.id} className="flex justify-between gap-2 border-b border-line/50 py-1">
              <span>
                {formatLocalDate(l.date, 'compact')} · {l.modality}
              </span>
              <span>
                {formatDecimal(l.durationMin)} min{l.distanceKm !== null ? ` · ${formatDecimal(l.distanceKm)} km` : ''}
                {l.rpe !== null ? ` · esfuerzo ${l.rpe}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
