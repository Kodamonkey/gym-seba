import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useActiveSession, usePrefs, useTimeZone, useToday } from '../../app/hooks';
import { addDays, diffDays, formatLocalDate, startOfWeek } from '../../domain/dates';
import { PLAN_STATUS_LABEL, PLAN_STATUS_SYMBOL } from '../../domain/schedule';
import { db, describeStorageError } from '../../data/db';
import { endAdaptation, keepAdaptation, moveScheduledWorkout, setSkipped, startFreeWorkout, startScheduledWorkout } from '../../data/program';
import { ActiveSessionExistsError } from '../../data/sessions';
import { Button, Card, Dialog, EmptyState, Field, Loading, Pill, SectionTitle, Select } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { usePlan, type PlannedItem } from '../plan';

function StatusPill({ item }: { item: PlannedItem }) {
  const tone = item.status === 'completed' ? 'ok' : item.status === 'partial' ? 'warn' : item.status === 'skipped' ? 'danger' : item.status === 'unclassified' ? 'warn' : 'neutral';
  return (
    <Pill tone={tone}>
      <span aria-hidden>{PLAN_STATUS_SYMBOL[item.status]}</span> {PLAN_STATUS_LABEL[item.status]}
    </Pill>
  );
}

export function TodayPage() {
  const today = useToday();
  const tz = useTimeZone();
  const plan = usePlan(today);
  const active = useActiveSession();
  const prefs = usePrefs();
  const lastBackup = useLiveQuery(async () => (await db.meta.get('lastBackupAt'))?.value as string | undefined, []);
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [moving, setMoving] = useState<PlannedItem | null>(null);
  const [moveDate, setMoveDate] = useState('');
  const [freeDay, setFreeDay] = useState('');

  if (!plan) return <Loading />;
  const { program, template, items } = plan;

  const todays = items.filter((i) => i.sw.date === today);
  const overdue = items.filter((i) => i.status === 'unclassified').slice(-3);
  const weekStart = startOfWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const weekItems = items.filter((i) => i.sw.date >= weekStart && i.sw.date <= weekEnd);
  const weekDone = plan.sessions.filter((s) => s.localDate >= weekStart && s.localDate <= weekEnd && (s.status === 'completed' || s.status === 'partial'));
  const next = items.find((i) => i.sw.date > today && i.status === 'planned');

  async function start(fn: () => Promise<unknown>, key: string) {
    setBusy(key);
    try {
      await fn();
      navigate('/sesion');
    } catch (e) {
      if (e instanceof ActiveSessionExistsError) {
        toast({ message: e.message, tone: 'error', action: { label: 'Ir a la sesión', run: () => navigate('/sesion') } });
      } else toast({ message: e instanceof Error && !(e as { name?: string }).name?.includes('Dexie') ? e.message : describeStorageError(e), tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  const backupAge = lastBackup ? diffDays(lastBackup.slice(0, 10), today) : null;
  const remindBackup = prefs && prefs.backupReminderDays > 0 && plan.sessions.some((s) => s.status === 'completed' || s.status === 'partial') && (backupAge === null || backupAge >= prefs.backupReminderDays);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-sm text-muted">{formatLocalDate(today, 'long')}</p>
        <h1 className="text-2xl font-bold">Hoy</h1>
        {program && plan.week !== null && (
          <p className="text-sm text-muted">
            {plan.week >= 1 ? `Semana ${Math.min(plan.week, program.weeks)} de ${program.weeks} del programa` : `El programa empieza el ${formatLocalDate(program.startDate)}`}
            {plan.adaptation?.active && plan.week >= 1 ? ' · fase de adaptación' : ''}
          </p>
        )}
      </div>

      {active && (
        <Card className="border-accent">
          <p className="font-semibold">Tienes una sesión en curso: {active.title}</p>
          <p className="text-sm text-muted">Se guardó automáticamente. Puedes continuar donde la dejaste.</p>
          <Button variant="primary" size="lg" className="mt-3 w-full" onClick={() => navigate('/sesion')}>
            Continuar sesión
          </Button>
        </Card>
      )}

      {plan.adaptation?.pendingDecision && program && (
        <Card className="border-warn">
          <p className="font-semibold">¿Mantener la fase de adaptación?</p>
          <p className="text-sm text-muted">{plan.adaptation.reason} Mientras decides, se mantiene la adaptación (2 series de trabajo).</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => keepAdaptation(program, today).then(() => toast({ message: 'Adaptación extendida una semana.', tone: 'ok' }))}>
              Mantener una semana más
            </Button>
            <Button onClick={() => endAdaptation(program).then(() => toast({ message: 'Adaptación terminada: se usarán las series completas.', tone: 'ok' }))}>
              Terminar adaptación
            </Button>
          </div>
        </Card>
      )}

      <section>
        <SectionTitle>Entrenamiento de hoy</SectionTitle>
        {todays.length === 0 ? (
          <EmptyState title="Hoy es descanso o actividad opcional">
            {next ? (
              <>
                Próxima sesión: <strong>{next.day?.name}</strong>, {formatLocalDate(next.sw.date)}.
              </>
            ) : (
              'No hay sesiones planificadas próximamente.'
            )}
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {todays.map((i) => (
              <Card key={i.sw.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-semibold">{i.day?.name ?? 'Día eliminado de la plantilla'}</h3>
                    <p className="text-sm text-muted">
                      {i.day?.exercises.length ?? 0} ejercicios · ~{i.day ? i.day.timeSplit.warmupMin + i.day.timeSplit.strengthMin + i.day.timeSplit.cardioMin + i.day.timeSplit.cooldownMin : 0} min
                    </p>
                  </div>
                  <StatusPill item={i} />
                </div>
                {i.day && (
                  <ol className="mt-3 flex flex-col gap-1 text-sm">
                    {i.day.exercises.map((ex, n) => (
                      <li key={ex.id} className="text-muted">
                        {n + 1}. <ExerciseName variantId={ex.variantId} />
                      </li>
                    ))}
                  </ol>
                )}
                {i.status === 'planned' && i.day && (
                  <Button variant="primary" size="lg" className="mt-4 w-full" busy={busy === i.sw.id} disabled={!!active} onClick={() => start(() => startScheduledWorkout(i.sw.id, tz), i.sw.id)}>
                    Iniciar entrenamiento
                  </Button>
                )}
                {i.session && (
                  <Link to={i.status === 'in-progress' ? '/sesion' : `/historial/${i.session.id}`} className="mt-3 inline-block text-sm text-accent underline">
                    {i.status === 'in-progress' ? 'Ir a la sesión' : 'Ver registro'}
                  </Link>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {overdue.length > 0 && (
        <section>
          <SectionTitle>Sesiones pasadas sin registrar</SectionTitle>
          <p className="mb-2 text-sm text-muted">No se marcan como completadas automáticamente. Clasifícalas o reprográmalas (sin duplicar volumen).</p>
          <div className="flex flex-col gap-2">
            {overdue.map((i) => (
              <Card key={i.sw.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{i.day?.name}</p>
                  <p className="text-sm text-muted">{formatLocalDate(i.sw.date)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setMoving(i);
                      setMoveDate(today);
                    }}
                  >
                    Reprogramar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSkipped(i.sw.id, true).then(() => toast({ message: 'Marcada como omitida.', tone: 'ok', action: { label: 'Deshacer', run: () => setSkipped(i.sw.id, false) } }))}>
                    Marcar omitida
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle action={<Link to="/calendario" className="text-sm text-accent underline">Calendario</Link>}>Esta semana</SectionTitle>
        <Card>
          <p className="text-2xl font-bold tabular">
            {weekDone.length}{' '}
            <span className="text-base font-normal text-muted">
              {weekDone.length === 1 ? 'sesión registrada' : 'sesiones registradas'} · {weekItems.length} planificada{weekItems.length === 1 ? '' : 's'} esta semana
            </span>
          </p>
          <ul className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
            {Array.from({ length: 7 }, (_, k) => addDays(weekStart, k)).map((d) => {
              const it = weekItems.find((x) => x.sw.date === d);
              return (
                <li key={d} className={`rounded-lg py-2 ${d === today ? 'bg-surface-3 font-semibold' : 'bg-surface-2'}`}>
                  <div>{formatLocalDate(d, 'compact').split(' ')[0]}</div>
                  <div aria-label={it ? PLAN_STATUS_LABEL[it.status] : 'Descanso'}>{it ? PLAN_STATUS_SYMBOL[it.status] : PLAN_STATUS_SYMBOL.rest}</div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-faint">● completada · ◑ parcial · ○ planificada · ? sin registrar · ✕ omitida · – descanso</p>
        </Card>
      </section>

      {template && !active && (
        <section>
          <SectionTitle>Entrenar otro día de la rutina</SectionTitle>
          <Card className="flex flex-col gap-2">
            <Select
              label="Día de la rutina"
              value={freeDay}
              onChange={setFreeDay}
              options={[{ value: '', label: 'Elige un día…' }, ...template.days.map((d) => ({ value: d.id, label: d.name }))]}
            />
            <Button
              disabled={!freeDay}
              busy={busy === 'free'}
              onClick={() => start(() => startFreeWorkout(template.id, freeDay, tz, plan.adaptation?.active ?? true), 'free')}
            >
              Iniciar sesión libre (no cuenta como planificada)
            </Button>
          </Card>
        </section>
      )}

      {remindBackup && (
        <Card className="border-info">
          <p className="font-medium">{backupAge === null ? 'Aún no has exportado un respaldo.' : `Último respaldo hace ${backupAge} días.`}</p>
          <p className="text-sm text-muted">Tus datos viven solo en este navegador: borrar los datos del sitio puede eliminarlos.</p>
          <Link to="/ajustes#respaldo" className="mt-2 inline-block text-sm text-accent underline">
            Exportar respaldo
          </Link>
        </Card>
      )}

      <p className="text-xs text-faint">Revisa la técnica con un entrenador al comenzar y detén la serie ante dolor inusual.</p>

      <Dialog
        open={!!moving}
        onClose={() => setMoving(null)}
        title="Reprogramar sesión"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMoving(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                if (!moving) return;
                try {
                  await moveScheduledWorkout(moving.sw.id, moveDate);
                  toast({ message: `Movida al ${formatLocalDate(moveDate)}.`, tone: 'ok' });
                  setMoving(null);
                } catch (e) {
                  toast({ message: e instanceof Error ? e.message : 'No se pudo mover.', tone: 'error' });
                }
              }}
            >
              Mover
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">Se mueve solo esta sesión. No se duplica volumen en otros días.</p>
        <Field label="Nueva fecha" type="date" value={moveDate} min={today} onChange={(e) => setMoveDate(e.target.value)} />
      </Dialog>
    </div>
  );
}

function ExerciseName({ variantId }: { variantId: string }) {
  const v = useLiveQuery(() => db.variants.get(variantId), [variantId]);
  return <>{v?.name ?? '…'}</>;
}
