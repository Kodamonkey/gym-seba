import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { usePrefs } from '../../app/hooks';
import { formatLocalDate } from '../../domain/dates';
import type { Preferences } from '../../domain/types';
import { applyImport, downloadText, exportBackup, markBackupDone, parseBackup, previewImport, type BackupFile, type ImportPolicy, type ImportPreview } from '../../data/backup';
import { db, nowIso, userMessage } from '../../data/db';
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
  if (!prefs) return null;
  const set = (p: Partial<Preferences>) => db.prefs.update('prefs', { ...p, updatedAt: nowIso() });
  return (
    <section className="mt-2">
      <SectionTitle>Entrenamiento</SectionTitle>
      <div className="divide-y divide-line">
        <Toggle label="Iniciar descanso al marcar una serie" checked={prefs.autoStartRest} onChange={(v) => set({ autoStartRest: v })} />
        <Toggle label="Vibrar al terminar el descanso" checked={prefs.restVibration} onChange={(v) => set({ restVibration: v })} />
        <Toggle label="Sonido al terminar el descanso" checked={prefs.restSound} onChange={(v) => set({ restSound: v })} />
        <Toggle label="Mantener la pantalla encendida" checked={prefs.keepAwake} onChange={(v) => set({ keepAwake: v })} hint="Mientras entrenas" />
      </div>
    </section>
  );
}

function stamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
}

async function downloadBackupNow() {
  const b = await exportBackup();
  downloadText(`atlas-respaldo-${stamp()}.json`, JSON.stringify(b, null, 2));
  await markBackupDone();
}

function BackupSection() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const lastBackup = useLiveQuery(async () => (await db.meta.get('lastBackupAt'))?.value as string | undefined, []);
  const [incoming, setIncoming] = useState<BackupFile | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [policy, setPolicy] = useState<ImportPolicy>('merge-skip');
  const [backedUp, setBackedUp] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return toast({ message: 'El archivo supera 50 MB.', tone: 'error' });
    const r = parseBackup(await file.text());
    if (!r.ok) return toast({ message: `El archivo no se importó: ${r.errors[0] ?? 'formato no válido'}`, tone: 'error' });
    setPolicy('merge-skip');
    setBackedUp(false);
    setIncoming(r.data);
    setPreview(await previewImport(r.data, 'merge-skip'));
  }

  const close = () => {
    setIncoming(null);
    setPreview(null);
  };
  const needsBackup = policy !== 'merge-skip';

  return (
    <section className="mt-6">
      <SectionTitle>Respaldo</SectionTitle>
      <p className="text-sm text-muted">
        Último respaldo: <span className="font-medium text-text">{lastBackup ? formatLocalDate(lastBackup.slice(0, 10)) : 'nunca'}</span>. Si borras los datos del navegador, se pierde
        el historial: exporta de vez en cuando.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        <Button variant="primary" onClick={() => downloadBackupNow().then(() => toast({ message: 'Respaldo descargado.' }))}>
          Exportar respaldo
        </Button>
        <Button onClick={() => fileRef.current?.click()}>Importar respaldo</Button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Archivo de respaldo" />
      </div>

      <Dialog
        open={!!(incoming && preview)}
        onClose={close}
        title="Importar respaldo"
        footer={
          <>
            {needsBackup && (
              <Button onClick={() => downloadBackupNow().then(() => setBackedUp(true))}>{backedUp ? 'Respaldo actual descargado' : 'Primero, descargar mis datos actuales'}</Button>
            )}
            <Button
              variant="primary"
              size="lg"
              busy={busy}
              disabled={needsBackup && !backedUp}
              onClick={async () => {
                if (!incoming) return;
                setBusy(true);
                try {
                  const r = await applyImport(incoming, policy);
                  toast({ message: `Importación completa: ${r.written} registros.` });
                  close();
                } catch (e) {
                  const reason = e instanceof Error && e.message.startsWith('La importación') ? e.message : userMessage(e);
                  toast({ message: `${reason} No se modificó nada.`, tone: 'error' });
                } finally {
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
              Respaldo del {formatLocalDate(incoming.exportedAt.slice(0, 10))}: {preview.totals.added} registros nuevos, {preview.totals.identical} iguales y {preview.totals.conflicts}{' '}
              distintos a los tuyos.
              {policy === 'replace-all' && <strong className="block text-warn">Se eliminarán {preview.totals.removed} registros que no están en el archivo.</strong>}
            </p>
            <Select
              label="Qué hacer"
              value={policy}
              onChange={(v) => {
                setPolicy(v as ImportPolicy);
                setBackedUp(false);
                void previewImport(incoming, v as ImportPolicy).then(setPreview);
              }}
              options={[
                { value: 'merge-skip', label: 'Añadir solo lo nuevo' },
                { value: 'merge-replace', label: 'Añadir y reemplazar lo distinto' },
                { value: 'replace-all', label: 'Reemplazar todo por el archivo' },
              ]}
            />
          </div>
        )}
      </Dialog>
    </section>
  );
}
