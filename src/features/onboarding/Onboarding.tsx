import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useProfile, useToday } from '../../app/hooks';
import { formatLocalDate, isLocalDate, weekdayName } from '../../domain/dates';
import { parseDecimal } from '../../domain/validation';
import { db, nowIso, uid, userMessage } from '../../data/db';
import { createProgram } from '../../data/program';
import { Button, Card, Field, Select } from '../../ui/primitives';
import { useToast } from '../../ui/toast';

const WEEKDAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ value: String(d), label: weekdayName(d) }));

/** Configuración inicial: confirma datos, fecha de inicio y medición inicial. No inventa historial. */
export function Onboarding() {
  const profile = useProfile();
  const template = useLiveQuery(() => db.routineTemplates.get('rt-atlas-4d'), []);
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [experience, setExperience] = useState('');
  const [gym, setGym] = useState('');
  const [startDate, setStartDate] = useState('');
  const [weekdays, setWeekdays] = useState<Record<string, number>>({});
  const [measure, setMeasure] = useState(true);
  const [mDate, setMDate] = useState('');
  const [mWeight, setMWeight] = useState('');
  const [mWaist, setMWaist] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setHeight(profile.heightCm?.toString() ?? '');
    setWeight(profile.weightKg?.toString() ?? '');
    setExperience(profile.experience);
    setGym(profile.gymName);
  }, [profile]);

  useEffect(() => {
    if (template) setWeekdays(Object.fromEntries(template.days.map((d) => [d.id, d.weekday])));
  }, [template]);

  useEffect(() => {
    setStartDate((s) => s || today);
    setMDate((s) => s || today);
  }, [today]);

  if (!profile || !template) return null;

  async function submit() {
    const errs: Record<string, string> = {};
    const h = parseDecimal(height, 'La estatura');
    const w = parseDecimal(weight, 'El peso');
    if (!h.ok) errs.height = h.error;
    if (!w.ok) errs.weight = w.error;
    if (!isLocalDate(startDate)) errs.startDate = 'Elige la fecha de inicio del programa.';
    const mw = parseDecimal(mWeight, 'El peso');
    const mwa = parseDecimal(mWaist, 'La cintura');
    if (measure) {
      if (!isLocalDate(mDate)) errs.mDate = 'Confirma la fecha de la medición.';
      if (!mw.ok) errs.mWeight = mw.error;
      if (!mwa.ok) errs.mWaist = mwa.error;
      if (mw.ok && mwa.ok && mw.value === null && mwa.value === null) errs.mWeight = 'Ingresa al menos el peso o la cintura, o desactiva la medición inicial.';
    }
    const used = Object.values(weekdays);
    if (new Set(used).size !== used.length) errs.weekdays = 'Cada día de entrenamiento debe caer en un día distinto de la semana.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const now = nowIso();
      await db.profile.update('me', {
        name: name.trim() || 'Yo',
        heightCm: h.ok ? h.value : null,
        weightKg: w.ok ? w.value : null,
        experience,
        gymName: gym,
        onboardedAt: now,
        updatedAt: now,
      });
      await createProgram({ templateId: template!.id, startDate, timeZone: profile!.timeZone, weekdays });
      if (measure && mw.ok && mwa.ok) {
        await db.bodyMeasurements.add({ id: uid(), date: mDate, weightKg: mw.value, waistCm: mwa.value, notes: 'Medición inicial', createdAt: now, updatedAt: now });
      }
      toast({ message: 'Programa creado. Ya puedes registrar tus sesiones.', tone: 'ok' });
      navigate('/', { replace: true });
    } catch (e) {
      toast({ message: userMessage(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Bienvenido a ATLAS</h1>
        <p className="mt-1 text-muted">
          Confirma tus datos. Todo queda guardado solo en este dispositivo y es editable después. ATLAS no calcula cargas, metas ni grasa
          corporal a partir de tu estatura o peso.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Tus datos</h2>
        <Field label="Nombre" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estatura" inputMode="decimal" suffix="cm" value={height} onChange={(e) => setHeight(e.target.value)} error={errors.height} />
          <Field label="Peso informado" inputMode="decimal" suffix="kg" value={weight} onChange={(e) => setWeight(e.target.value)} error={errors.weight} />
        </div>
        <Field label="Experiencia" value={experience} onChange={(e) => setExperience(e.target.value)} />
        <Field label="Gimnasio" value={gym} onChange={(e) => setGym(e.target.value)} hint="Solo como referencia; ATLAS no tiene relación con ninguna cadena de gimnasios." />
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">Programa: {template.name}</h2>
        <p className="text-sm text-muted">
          {template.weeksTotal} semanas, {template.days.length} días por semana. Las semanas 1–{template.adaptation.weeks} son de adaptación con{' '}
          {template.adaptation.setsPerExercise} series de trabajo por ejercicio. Es una configuración acordada para esta app, no una prescripción médica.
        </p>
        <Field
          label="Fecha de inicio del programa"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          error={errors.startDate}
          hint={isLocalDate(startDate) ? `Empieza el ${formatLocalDate(startDate, 'long')}.` : undefined}
        />
        <div className="grid grid-cols-2 gap-3">
          {template.days.map((d) => (
            <Select
              key={d.id}
              label={d.name}
              value={String(weekdays[d.id] ?? d.weekday)}
              onChange={(v) => setWeekdays((w) => ({ ...w, [d.id]: Number(v) }))}
              options={WEEKDAY_OPTIONS}
            />
          ))}
        </div>
        {errors.weekdays && (
          <p className="text-sm text-danger" role="alert">
            {errors.weekdays}
          </p>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={measure} onChange={(e) => setMeasure(e.target.checked)} className="h-5 w-5" />
          Registrar una medición inicial
        </label>
        {measure && (
          <>
            <Field label="Fecha de la medición" type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} error={errors.mDate} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Peso" inputMode="decimal" suffix="kg" value={mWeight} onChange={(e) => setMWeight(e.target.value)} error={errors.mWeight} placeholder={weight} />
              <Field label="Cintura (opcional)" inputMode="decimal" suffix="cm" value={mWaist} onChange={(e) => setMWaist(e.target.value)} error={errors.mWaist} />
            </div>
            <p className="text-xs text-faint">Solo se guarda lo que escribas; los campos vacíos quedan sin registrar.</p>
          </>
        )}
      </Card>

      <p className="text-sm text-faint">
        Recomendación: revisa la técnica de cada ejercicio con un entrenador al comenzar y detén la serie ante dolor inusual. Esta app no
        diagnostica ni certifica la ejecución.
      </p>
      <Button variant="primary" size="lg" onClick={submit} busy={busy}>
        Crear programa y empezar
      </Button>
    </div>
  );
}
