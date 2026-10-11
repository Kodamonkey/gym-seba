import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { formatLocalDate } from '../../domain/dates';
import { comparisonKeyOf, describeNormalization, loadContextOf, loadLabel } from '../../domain/load';
import { adviseProgression } from '../../domain/progression';
import type { ExerciseVariant, ProgressionDecision, SessionExercise, SetLog, WorkoutSession } from '../../domain/types';
import { formatDecimal, parseLoad } from '../../domain/validation';
import { db, describeStorageError, nowIso, uid, userMessage } from '../../data/db';
import {
  addSet,
  removeExerciseFromSession,
  setEquipmentInstance,
  setUnilateralLogging,
  substituteVariant,
  updateSessionExercise,
} from '../../data/sessions';
import { Button, Card, Dialog, Field, Pill } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { DemoBlock } from '../exercise/DemoBlock';
import { MuscleInfo, TechniqueInfo } from '../exercise/MuscleInfo';
import { saveEquipmentNote, suggestionsFor, type Suggestion } from './logic';
import { SetRow } from './SetRow';

interface Props {
  session: WorkoutSession;
  se: SessionExercise;
  sets: SetLog[];
  canEdit: boolean;
}

export function ExercisePanel({ session, se, sets, canEdit }: Props) {
  const toast = useToast();
  const variant = useLiveQuery(() => db.variants.get(se.variantId), [se.variantId]);
  const equipment = useLiveQuery(() => db.equipment.where('variantIds').equals(se.variantId).toArray(), [se.variantId]);
  const note = useLiveQuery(
    async () => (se.equipmentInstanceId ? ((await db.equipmentNotes.where('equipmentId').equals(se.equipmentInstanceId).first()) ?? null) : null),
    [se.equipmentInstanceId],
  );
  const [sugg, setSugg] = useState<{ prev: Awaited<ReturnType<typeof suggestionsFor>>['prev']; byOrder: Map<number, Suggestion> } | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  // Estado optimista de los controles (la base confirma en milisegundos y se re-sincroniza).
  const [tech, setTech] = useState(se.techniqueConfirmed);
  const [pain, setPain] = useState(se.painReported);
  useEffect(() => setTech(se.techniqueConfirmed), [se.techniqueConfirmed]);
  useEffect(() => setPain(se.painReported), [se.painReported]);
  const key = comparisonKeyOf(se);

  useEffect(() => {
    let alive = true;
    suggestionsFor(se).then((r) => alive && setSugg(r));
    return () => {
      alive = false;
    };
  }, [se.id, se.variantId, se.equipmentInstanceId, se.rev]);

  useEffect(() => setNoteText(note?.text ?? ''), [note?.id, note?.text]);

  const live = sets.filter((s) => s.deletedAt === null).sort((a, b) => a.order - b.order);
  const workSets = live.filter((s) => s.kind === 'work');
  const doneWork = workSets.filter((s) => s.status === 'completed');
  const perSideRows = se.variant.laterality === 'unilateral' && se.unilateralLogging === 'per-side-rows';
  const expected = se.prescribed.sets * (perSideRows ? 2 : 1);
  const p = se.prescribed;
  const hasCompleted = live.some((s) => s.status === 'completed');

  const workIndex = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const s of live) {
      if (s.kind !== 'work') continue;
      // En filas por lado, el lado derecho comparte el número de la serie izquierda previa.
      m.set(s.id, perSideRows && s.side === 'right' && n > 0 ? n : ++n);
    }
    return m;
  }, [live, perSideRows]);

  if (!variant) return null;

  const target =
    se.variant.measure === 'time'
      ? `${p.sets} × ${p.durationMin ?? '?'}–${p.durationMax ?? '?'} s`
      : `${p.sets} × ${p.repMin === p.repMax ? p.repMin : `${p.repMin}–${p.repMax}`}${p.repsMode === 'per-side' ? ' por lado' : ''}`;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3 md:sticky md:top-20 md:self-start">
        <DemoBlock variant={variant} />
        <Card className="flex flex-col gap-4">
          <MuscleInfo variant={variant} />
          <TechniqueInfo variant={variant} />
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <Card className="flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold">{se.variant.name}</h2>
              {se.substitutedFromVariantId && <p className="text-xs text-warn">Alternativa elegida en esta sesión</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {Object.entries(se.variant.config).map(([k, v]) => (
                  <Pill key={k}>
                    {k}: {v}
                  </Pill>
                ))}
                {se.variant.laterality === 'unilateral' && <Pill tone="info">Unilateral</Pill>}
              </div>
            </div>
            <Pill tone={doneWork.length >= expected ? 'ok' : 'neutral'}>
              {doneWork.length}/{expected} series
            </Pill>
          </div>
          <p className="text-lg">
            <strong className="tabular">{target}</strong>
            <span className="text-muted">
              {' '}
              · RIR {p.rirMin}–{p.rirMax} · descanso {p.restSec} s
            </span>
          </p>
          <p className="text-xs text-faint">RIR = repeticiones adicionales que crees que podrías realizar. Es opcional.</p>
          <p className="text-xs text-faint">
            Carga: {loadLabel(se.variant.loadConvention, se.variant.implements, se.unit)}. {describeNormalization(loadContextOf(se))}
          </p>

          {se.variant.requiresEquipmentInstance && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-muted" htmlFor={`eq-${se.id}`}>
                Máquina / equipo concreto
              </label>
              <select
                id={`eq-${se.id}`}
                className="min-h-11 w-full min-w-0 rounded-lg border border-line bg-surface-2 px-3"
                value={se.equipmentInstanceId ?? ''}
                disabled={!canEdit}
                onChange={(e) => setEquipmentInstance(se.id, e.target.value || null).catch((err) => toast({ message: describeStorageError(err), tone: 'error' }))}
              >
                <option value="">Sin identificar</option>
                {(equipment ?? [])
                  .filter((x) => !x.archived)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                      {x.location ? ` · ${x.location}` : ''}
                      {x.status === 'unavailable' ? ' (no disponible)' : x.status === 'unverified' ? ' (por verificar)' : ''}
                    </option>
                  ))}
              </select>
              {!key.confirmed && <p className="text-xs text-warn">Comparabilidad no confirmada: identifica la máquina para comparar cargas y récords.</p>}
              {se.equipmentInstanceId && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="text-muted">Notas de esta máquina (p. ej. "asiento 4, respaldo 2")</span>
                  <textarea
                    className="min-h-16 rounded-lg border border-line bg-surface-2 p-2"
                    value={noteText}
                    disabled={!canEdit}
                    onChange={(e) => setNoteText(e.target.value)}
                    onBlur={() => noteText !== (note?.text ?? '') && saveEquipmentNote(se.equipmentInstanceId!, noteText).then(() => toast({ message: 'Nota de la máquina guardada.', tone: 'ok' }))}
                  />
                  <span className="text-xs text-faint">Se guarda solo para esta máquina; no se aplica a otras.</span>
                </label>
              )}
            </div>
          )}

          <PreviousRecord sugg={sugg} confirmed={key.confirmed} unit={se.unit} />
        </Card>

        {se.variant.laterality === 'unilateral' && (
          <Card className="flex flex-col gap-2 text-sm">
            <label className="flex flex-col gap-1">
              <span className="text-muted">Cómo registrar los lados</span>
              <select
                className="min-h-11 w-full min-w-0 rounded-lg border border-line bg-surface-2 px-3"
                value={se.unilateralLogging}
                disabled={!canEdit || hasCompleted}
                onChange={(e) => setUnilateralLogging(se.id, e.target.value as SessionExercise['unilateralLogging']).catch((err) => toast({ message: err.message, tone: 'error' }))}
              >
                <option value="one-row-per-side-reps">Una fila por serie con repeticiones por lado</option>
                <option value="per-side-rows">Una fila por cada lado</option>
              </select>
            </label>
            {perSideRows && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={se.restBetweenSides} disabled={!canEdit} onChange={(e) => updateSessionExercise(se.id, { restBetweenSides: e.target.checked })} className="h-5 w-5" />
                Descansar también entre lados (si no, el descanso empieza tras ambos lados)
              </label>
            )}
          </Card>
        )}

        <ol className="flex flex-col gap-2" aria-label="Series">
          {live.map((s, i) => (
            <SetRow
              key={s.id}
              set={s}
              index={i}
              se={se}
              suggestion={s.kind === 'work' ? sugg?.byOrder.get((workIndex.get(s.id) ?? 1) - 1) : undefined}
              canEdit={canEdit}
              workNumber={workIndex.get(s.id) ?? null}
            />
          ))}
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button disabled={!canEdit} onClick={() => addSet(se.id, 'work')}>
            + Serie
          </Button>
          <Button disabled={!canEdit} onClick={() => addSet(se.id, 'warmup')}>
            + Calentamiento
          </Button>
          <Button disabled={!canEdit} onClick={() => setSubOpen(true)}>
            Sustituir
          </Button>
          {!hasCompleted && (
            <Button
              variant="ghost"
              disabled={!canEdit}
              onClick={() => removeExerciseFromSession(se.id).then(() => toast({ message: 'Ejercicio quitado de esta sesión.', tone: 'ok' }))}
            >
              Quitar de la sesión
            </Button>
          )}
        </div>

        <Card className="flex flex-col gap-2 text-sm">
          <fieldset className="flex flex-wrap items-center gap-3" disabled={!canEdit}>
            <legend className="mb-1 text-muted">¿Técnica correcta en todas las series?</legend>
            {[
              { v: true, l: 'Sí' },
              { v: false, l: 'No' },
              { v: null, l: 'Sin indicar' },
            ].map((o) => (
              <label key={String(o.v)} className="flex min-h-11 items-center gap-2">
                <input
                  type="radio"
                  name={`tech-${se.id}`}
                  checked={tech === o.v}
                  onChange={() => {
                    setTech(o.v);
                    void updateSessionExercise(se.id, { techniqueConfirmed: o.v });
                  }}
                  className="h-5 w-5"
                />
                {o.l}
              </label>
            ))}
          </fieldset>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={pain}
              disabled={!canEdit}
              onChange={(e) => {
                setPain(e.target.checked);
                void updateSessionExercise(se.id, { painReported: e.target.checked });
              }}
              className="h-5 w-5"
            />
            Sentí dolor inusual (detén la serie y consulta si persiste)
          </label>
          <NotesField value={se.notes} disabled={!canEdit} onSave={(notes) => updateSessionExercise(se.id, { notes })} />
        </Card>

        {doneWork.length >= expected && <ProgressionCard session={session} se={se} workSets={doneWork} />}
      </div>

      <SubstituteDialog open={subOpen} onClose={() => setSubOpen(false)} session={session} se={se} variant={variant} />
    </div>
  );
}

function PreviousRecord({ sugg, confirmed, unit }: { sugg: { prev: Awaited<ReturnType<typeof suggestionsFor>>['prev'] } | null; confirmed: boolean; unit: string }) {
  if (!sugg) return <p className="text-sm text-faint">Buscando registro anterior…</p>;
  const prev = sugg.prev;
  if (!prev) return <p className="text-sm text-muted">Primer registro de esta variante y equipo.</p>;
  const work = prev.sets.filter((s) => s.kind === 'work');
  return (
    <div className="rounded-lg bg-surface-2 p-2 text-sm">
      <p className="text-muted">
        Anterior ({formatLocalDate(prev.session.localDate)}){!confirmed && ' · comparabilidad no confirmada'}:
      </p>
      <p className="font-medium tabular">
        {work
          .map((s) => `${s.load === null ? '—' : formatDecimal(s.load)}${unit === 'lb' ? ' lb' : ''} × ${s.reps ?? (s.durationSec ? `${s.durationSec}s` : '—')}${s.side ? (s.side === 'left' ? ' (izq.)' : ' (der.)') : ''}`)
          .join(' · ') || 'Sin series de trabajo'}
      </p>
      <p className="text-xs text-faint">Los valores en gris de cada fila son sugerencias: no cuentan hasta que confirmes la serie.</p>
    </div>
  );
}

function NotesField({ value, disabled, onSave }: { value: string; disabled: boolean; onSave: (v: string) => Promise<void> }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted">Notas del ejercicio en esta sesión</span>
      <textarea className="min-h-16 rounded-lg border border-line bg-surface-2 p-2" value={text} disabled={disabled} onChange={(e) => setText(e.target.value)} onBlur={() => text !== value && onSave(text)} />
    </label>
  );
}

function ProgressionCard({ session, se, workSets }: { session: WorkoutSession; se: SessionExercise; workSets: SetLog[] }) {
  const toast = useToast();
  const key = comparisonKeyOf(se).key;
  const equipment = useLiveQuery(async () => (se.equipmentInstanceId ? ((await db.equipment.get(se.equipmentInstanceId)) ?? null) : null), [se.equipmentInstanceId]);
  const decision = useLiveQuery(
    async () => (await db.progressionDecisions.where('comparisonKey').equals(key).toArray()).find((d) => d.sessionId === session.id) ?? null,
    [key, session.id],
  );
  const [adjust, setAdjust] = useState('');
  if (equipment === undefined || decision === undefined) return null;
  const advice = adviseProgression({
    prescribed: se.prescribed,
    measure: se.variant.measure,
    workSets,
    perSideRows: se.unilateralLogging === 'per-side-rows' && se.variant.laterality === 'unilateral',
    techniqueConfirmed: se.techniqueConfirmed,
    painReported: se.painReported,
    sessionComplete: session.status !== 'partial',
    minIncrement: equipment?.minIncrement ?? null,
    unit: se.unit,
  });

  async function decide(kind: ProgressionDecision['decision'], toLoad: number | null) {
    if (advice.kind !== 'suggest-increase') return;
    await db.progressionDecisions.add({
      id: uid(),
      comparisonKey: key,
      variantId: se.variantId,
      sessionId: session.id,
      decision: kind,
      fromLoad: advice.from,
      toLoad,
      unit: se.unit,
      createdAt: nowIso(),
    });
    toast({ message: kind === 'postponed' ? 'Decisión pospuesta.' : 'Guardado: se sugerirá esa carga la próxima vez (no se aplica sola).', tone: 'ok' });
  }

  return (
    <Card className={advice.kind === 'suggest-increase' ? 'border-accent' : ''}>
      <h3 className="font-semibold">Progresión</h3>
      <p className="mt-1 text-sm">{advice.message}</p>
      {advice.kind === 'suggest-increase' && !decision && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {advice.to !== null && (
              <Button variant="primary" size="sm" onClick={() => decide('accepted', advice.to)}>
                Aceptar {formatDecimal(advice.to)} {advice.unit} para la próxima
              </Button>
            )}
            <Button size="sm" onClick={() => decide('postponed', null)}>
              Posponer
            </Button>
          </div>
          <div className="flex items-end gap-2">
            <Field label="Ajustar a otra carga" inputMode="decimal" value={adjust} onChange={(e) => setAdjust(e.target.value)} suffix={advice.unit} />
            <Button
              size="sm"
              onClick={() => {
                const r = parseLoad(adjust);
                if (r.ok && r.value !== null) void decide('adjusted', r.value);
                else toast({ message: r.ok ? 'Indica una carga.' : r.error, tone: 'error' });
              }}
            >
              Guardar
            </Button>
          </div>
        </div>
      )}
      {decision && <p className="mt-2 text-xs text-muted">Decisión registrada: {decision.decision === 'postponed' ? 'pospuesta' : `${formatDecimal(decision.toLoad)} ${decision.unit} para la próxima sesión`}.</p>}
      {advice.kind === 'needs-confirmation' && <p className="mt-1 text-xs text-faint">Marca la técnica arriba y añade el RIR en las series.</p>}
    </Card>
  );
}

function SubstituteDialog({ open, onClose, session, se, variant }: { open: boolean; onClose: () => void; session: WorkoutSession; se: SessionExercise; variant: ExerciseVariant }) {
  const toast = useToast();
  const data = useLiveQuery(async () => {
    const program = session.programId ? await db.programs.get(session.programId) : undefined;
    const template = program ? await db.routineTemplates.get(program.templateId) : undefined;
    const slot = template?.days.find((d) => d.id === session.dayId)?.exercises.find((e) => e.id === se.slotId);
    const sameExercise = await db.variants.where('exerciseId').equals(variant.exerciseId).toArray();
    const ids = new Set([...(slot?.alternativeVariantIds ?? []), ...sameExercise.map((v) => v.id), ...(se.substitutedFromVariantId ? [se.substitutedFromVariantId] : [])]);
    ids.delete(se.variantId);
    const variants = (await db.variants.bulkGet([...ids])).filter((v): v is ExerciseVariant => !!v && !v.archived);
    return { slot, variants };
  }, [session.id, se.slotId, se.variantId, variant.exerciseId]);

  return (
    <Dialog open={open} onClose={onClose} title="Sustituir ejercicio">
      <p className="mb-3 text-sm text-muted">Las alternativas no son equivalentes en carga, estabilidad ni técnica: no se transfieren pesos ni récords entre ellas.</p>
      {data?.slot?.noDirectAlternativeNote && <p className="mb-3 rounded-lg bg-warn/10 p-2 text-sm text-warn">{data.slot.noDirectAlternativeNote}</p>}
      <ul className="flex flex-col gap-2">
        {data?.variants.map((v) => (
          <li key={v.id}>
            <Button
              className="w-full justify-start text-left"
              onClick={async () => {
                try {
                  await substituteVariant(se.id, v.id);
                  toast({ message: `Cambiado a: ${v.name}.`, tone: 'ok' });
                  onClose();
                } catch (e) {
                  toast({ message: userMessage(e), tone: 'error' });
                }
              }}
            >
              {v.name}
            </Button>
          </li>
        ))}
        {data && data.variants.length === 0 && <li className="text-sm text-muted">No hay alternativas definidas. Puedes crear una variante en Mi rutina.</li>}
      </ul>
    </Dialog>
  );
}
