import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { usePrefs, useTimeZone } from '../../app/hooks';
import { formatInstantWithOffset, formatLocalDate, localDateOf } from '../../domain/dates';
import type { Preferences } from '../../domain/types';
import { applyImport, downloadText, exportBackup, exportCsv, markBackupDone, parseBackup, previewImport, type BackupFile, type ImportPolicy, type ImportPreview } from '../../data/backup';
import { db, nowIso, userMessage, type UserTableName } from '../../data/db';
import { Button, Dialog, PageHeader, SectionTitle, Select, Toggle } from '../../ui/primitives';
import { useToast } from '../../ui/toast';

/** Ajustes mínimos: el descanso y el respaldo de tus datos. */
export function SettingsPage() {
  return (
    <div>
      <PageHeader back="/" title="Ajustes" />
      <RestSection />
      <BackupSection />
      <p className="mt-8 text-xs text-muted">
        Tus datos se guardan solo en este teléfono. ATLAS es una app personal: no es una herramienta médica. Revisa la técnica con un entrenador y detén la serie ante dolor
        inusual.
      </p>
    </div>
  );
}

function RestSection() {
  const prefs = usePrefs();
  const toast = useToast();
  if (!prefs) return null;
  const set = async (p: Partial<Preferences>) => {
    try {
      await db.prefs.update('prefs', { ...p, updatedAt: nowIso() });
    } catch (e) {
      toast({ message: userMessage(e), tone: 'error' });
    }
  };
  return (
    <section className="mt-2">
      <SectionTitle>Entrenamiento</SectionTitle>
      <div className="divide-y divide-line">
        <Toggle label="Iniciar descanso al marcar una serie" checked={prefs.autoStartRest} onChange={(v) => set({ autoStartRest: v })} />
        <Toggle label="Vibrar al terminar el descanso" checked={prefs.restVibration} onChange={(v) => set({ restVibration: v })} />
        <Toggle label="Sonido al terminar el descanso" checked={prefs.restSound} onChange={(v) => set({ restSound: v })} />
        <Toggle label="Mantener la pantalla encendida" checked={prefs.keepAwake} onChange={(v) => set({ keepAwake: v })} hint="Mientras entrenas" />
      </div>
      <p className="mt-2 text-xs text-muted">El navegador puede limitar sonido y vibración con el teléfono bloqueado.</p>
    </section>
  );
}

function stamp(timeZone: string): string {
  return formatInstantWithOffset(new Date().toISOString(), timeZone).slice(0, 16).replace(/[:T]/g, '-');
}

async function downloadBackupNow(timeZone: string) {
  const b = await exportBackup();
  downloadText(`atlas-respaldo-${stamp(timeZone)}.json`, JSON.stringify(b, null, 2));
  await markBackupDone();
}

const TABLE_LABELS: Record<UserTableName, string> = {
  profile: 'Perfil', prefs: 'Preferencias', exercises: 'Ejercicios', variants: 'Variantes', equipment: 'Equipos', equipmentNotes: 'Notas de equipos',
  routineTemplates: 'Rutinas', routineVersions: 'Versiones de rutinas', programs: 'Programas', scheduledWorkouts: 'Planificación', programDecisions: 'Decisiones del programa',
  sessions: 'Entrenamientos', sessionExercises: 'Ejercicios registrados', setLogs: 'Series', restTimers: 'Descanso', bodyMeasurements: 'Mediciones',
  cardioLogs: 'Cardio', progressionDecisions: 'Decisiones de cargas', media: 'Medios',
};

function BackupSection() {
  const toast = useToast();
  const timeZone = useTimeZone();
  const fileRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const exportRef = useRef(false);
  const importRef = useRef(false);
  const lastBackup = useLiveQuery(async () => (await db.meta.get('lastBackupAt'))?.value as string | undefined, []);
  const [incoming, setIncoming] = useState<BackupFile | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [policy, setPolicy] = useState<ImportPolicy>('merge-skip');
  const [backedUp, setBackedUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [exporting, setExporting] = useState<'json' | 'sessions' | 'sets' | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  async function onFile(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    const request = ++requestRef.current;
    setIncoming(null);
    setPreview(null);
    setErrors([]);
    setBackedUp(false);
    setPreviewBusy(true);
    try {
      if (file.size > 50 * 1024 * 1024) {
        setErrors(['El archivo supera 50 MB. No se importó nada.']);
        return;
      }
      const r = parseBackup(await file.text());
      if (request !== requestRef.current) return;
      if (!r.ok) {
        setErrors(r.errors.map((error) => `El archivo no se importó: ${error}`));
        return;
      }
      const next = await previewImport(r.data, 'merge-skip');
      if (request !== requestRef.current) return;
      setPolicy('merge-skip');
      setIncoming(r.data);
      setPreview(next);
    } catch (e) {
      if (request === requestRef.current) setErrors([`${userMessage(e)} No se importó nada.`]);
    } finally {
      if (request === requestRef.current) setPreviewBusy(false);
    }
  }

  const close = () => {
    if (importRef.current) return;
    requestRef.current++;
    setPreviewBusy(false);
    setIncoming(null);
    setPreview(null);
  };
  const needsBackup = policy !== 'merge-skip';
  const blockedBySession = !!preview?.activeSessionLocal && needsBackup;

  async function prepareExport(kind: 'json' | 'sessions' | 'sets', forImport = false) {
    if (exportRef.current) return;
    exportRef.current = true;
    setExporting(kind);
    try {
      if (kind === 'json') {
        await downloadBackupNow(timeZone);
        if (forImport) setBackedUp(true);
      } else {
        const csv = await exportCsv();
        downloadText(`atlas-${kind === 'sessions' ? 'sesiones' : 'series'}-${stamp(timeZone)}.csv`, csv[kind], 'text/csv');
      }
      toast({ message: kind === 'json' ? 'Respaldo preparado para descargar. Conserva el archivo.' : 'CSV preparado para descargar.' });
    } catch (e) {
      toast({ message: userMessage(e), tone: 'error' });
    } finally {
      exportRef.current = false;
      setExporting(null);
    }
  }

  async function changePolicy(nextPolicy: ImportPolicy) {
    if (!incoming || importRef.current) return;
    const request = ++requestRef.current;
    setPolicy(nextPolicy);
    setBackedUp(false);
    setPreviewBusy(true);
    try {
      const next = await previewImport(incoming, nextPolicy);
      if (request === requestRef.current) setPreview(next);
    } catch (e) {
      if (request === requestRef.current) {
        setPreview(null);
        setErrors([`${userMessage(e)} No se importó nada.`]);
        setIncoming(null);
      }
    } finally {
      if (request === requestRef.current) setPreviewBusy(false);
    }
  }

  return (
    <section className="mt-6">
      <SectionTitle>Respaldo</SectionTitle>
      <p className="text-sm text-muted">
        Último respaldo: <span className="font-medium text-text">{lastBackup ? formatLocalDate(localDateOf(new Date(lastBackup), timeZone)) : 'nunca'}</span>. Si borras los datos del navegador, se pierde
        el historial: exporta de vez en cuando.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <Button variant="primary" busy={exporting === 'json'} disabled={exporting !== null || busy} onClick={() => prepareExport('json')}>
          Exportar respaldo
        </Button>
        <Button disabled={previewBusy || busy || exporting !== null} onClick={() => fileRef.current?.click()}>Importar respaldo</Button>
        <details className="rounded-2xl border border-line px-4">
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium">Exportar para una hoja de cálculo</summary>
          <div className="flex flex-col gap-2 pb-4">
            <p className="text-xs text-muted">Los CSV permiten revisar los registros. Usa JSON para restaurar la app.</p>
            <Button busy={exporting === 'sessions'} disabled={exporting !== null || busy} onClick={() => prepareExport('sessions')}>Exportar sesiones (CSV)</Button>
            <Button busy={exporting === 'sets'} disabled={exporting !== null || busy} onClick={() => prepareExport('sets')}>Exportar series (CSV)</Button>
          </div>
        </details>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Archivo de respaldo" />
      </div>
      {previewBusy && !incoming && <p className="mt-3 text-sm text-muted" role="status">Revisando el respaldo…</p>}
      {errors.length > 0 && <ul className="mt-3 space-y-1 text-sm text-danger" role="alert">{errors.map((error, i) => <li key={i}>{error}</li>)}</ul>}

      <Dialog
        open={!!(incoming && preview)}
        onClose={close}
        title="Importar respaldo"
        footer={
          <>
            {needsBackup && (
              <Button busy={exporting === 'json'} disabled={busy || exporting !== null} onClick={() => prepareExport('json', true)}>{backedUp ? 'Respaldo actual preparado' : 'Primero, descargar mis datos actuales'}</Button>
            )}
            <Button
              variant="primary"
              size="lg"
              busy={busy}
              disabled={blockedBySession || previewBusy || exporting !== null || (needsBackup && !backedUp)}
              onClick={async () => {
                if (!incoming || importRef.current) return;
                importRef.current = true;
                setBusy(true);
                try {
                  const r = await applyImport(incoming, policy);
                  toast({ message: `Importación completa: ${r.written} registros.` });
                  importRef.current = false;
                  close();
                } catch (e) {
                  const reason = e instanceof Error && e.message.startsWith('La importación') ? e.message : userMessage(e);
                  toast({ message: `${reason} No se modificó nada.`, tone: 'error' });
                } finally {
                  importRef.current = false;
                  setBusy(false);
                }
              }}
            >
              Importar
            </Button>
          </>
        }
      >
        {incoming && preview && (
          <div className="flex flex-col gap-4 text-[15px]">
            <p className="text-muted">
              Respaldo del {formatLocalDate(localDateOf(new Date(incoming.exportedAt), timeZone))}: {preview.totals.added} registros nuevos, {preview.totals.identical} iguales y {preview.totals.conflicts}{' '}
              distintos a los tuyos.
              {policy === 'replace-all' && <strong className="block text-warn">Se eliminarán {preview.totals.removed} registros que no están en el archivo.</strong>}
            </p>
            {blockedBySession && <p className="rounded-xl bg-warn/10 p-3 text-sm text-warn">Termina o descarta el entrenamiento en curso antes de reemplazar datos. Puedes añadir solo lo nuevo sin interrumpirlo.</p>}
            <Select
              label="Qué hacer"
              value={policy}
              onChange={(v) => changePolicy(v as ImportPolicy)}
              options={[
                { value: 'merge-skip', label: 'Añadir solo lo nuevo' },
                { value: 'merge-replace', label: 'Añadir y reemplazar lo distinto' },
                { value: 'replace-all', label: 'Reemplazar todo por el archivo' },
              ]}
            />
            {previewBusy ? <p className="text-sm text-muted" role="status">Actualizando la vista previa…</p> : (
              <details>
                <summary className="flex min-h-11 cursor-pointer items-center font-medium">Ver registros por categoría</summary>
                <ul className="divide-y divide-line text-sm">
                  {Object.entries(preview.tables).filter(([, counts]) => counts.incoming > 0 || counts.removed > 0).map(([table, counts]) => (
                    <li key={table} className="py-2">
                      <span className="font-medium">{TABLE_LABELS[table as UserTableName]}</span>
                      <span className="mt-0.5 block text-muted">{counts.added} nuevos · {counts.identical} iguales · {counts.conflicts} distintos{policy === 'replace-all' ? ` · ${counts.removed} eliminados` : ''}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </Dialog>
    </section>
  );
}
