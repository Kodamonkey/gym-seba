import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { CLIPS } from '../../anatomy/clips';
import { useOnline, usePrefs, useProfile, useToday } from '../../app/hooks';
import { formatLocalDate } from '../../domain/dates';
import type { Preferences, UserProfile } from '../../domain/types';
import { parseDecimal } from '../../domain/validation';
import { applyImport, downloadText, exportBackup, exportCsv, markBackupDone, parseBackup, previewImport, type BackupFile, type ImportPolicy, type ImportPreview } from '../../data/backup';
import { db, nowIso, USER_TABLES, userMessage } from '../../data/db';
import { Button, Card, Dialog, Field, Select, SectionTitle, Toggle } from '../../ui/primitives';
import { useToast } from '../../ui/toast';

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Perfil y ajustes</h1>
      <ProfileSection />
      <PrefsSection />
      <BackupSection />
      <StorageSection />
      <section>
        <SectionTitle>Más</SectionTitle>
        <Card className="flex flex-col gap-2">
          <Link to="/fuentes" className="text-accent underline">
            Fuentes, licencias y cobertura de demostraciones
          </Link>
          <Link to="/demos" className="text-accent underline">
            Galería de demostraciones anatómicas
          </Link>
          <p className="text-xs text-faint">
            ATLAS es una app personal. No es una herramienta médica, no diagnostica ni certifica la técnica, y no tiene relación con ninguna cadena de gimnasios.
          </p>
        </Card>
      </section>
    </div>
  );
}

/* ---------- Perfil ---------- */

function ProfileSection() {
  const profile = useProfile();
  const toast = useToast();
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [h, setH] = useState('');
  const [w, setW] = useState('');
  useEffect(() => {
    if (profile && !draft) {
      setDraft(profile);
      setH(profile.heightCm?.toString().replace('.', ',') ?? '');
      setW(profile.weightKg?.toString().replace('.', ',') ?? '');
    }
  }, [profile, draft]);
  if (!draft) return null;
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['America/Santiago'];
  return (
    <section>
      <SectionTitle>Perfil</SectionTitle>
      <Card className="flex flex-col gap-3">
        <Field label="Nombre" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Estatura" suffix="cm" inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} />
          <Field label="Peso informado" suffix="kg" inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} />
        </div>
        <Field label="Experiencia" value={draft.experience} onChange={(e) => setDraft({ ...draft, experience: e.target.value })} />
        <Field label="Capacidades" value={draft.capabilities} onChange={(e) => setDraft({ ...draft, capabilities: e.target.value })} />
        <Field label="Objetivo" value={draft.goal} onChange={(e) => setDraft({ ...draft, goal: e.target.value })} />
        <Field label="Gimnasio de referencia" value={draft.gymName} onChange={(e) => setDraft({ ...draft, gymName: e.target.value })} />
        <Select
          label="Zona horaria"
          value={draft.timeZone}
          onChange={(v) => setDraft({ ...draft, timeZone: v })}
          options={zones.map((z) => ({ value: z, label: z }))}
          hint="Cambiarla no altera la fecha local guardada de sesiones pasadas."
        />
        <Button
          variant="primary"
          onClick={async () => {
            const ph = parseDecimal(h, 'La estatura');
            const pw = parseDecimal(w, 'El peso');
            if (!ph.ok || !pw.ok) return toast({ message: !ph.ok ? ph.error : !pw.ok ? pw.error : '', tone: 'error' });
            await db.profile.put({ ...draft, heightCm: ph.value, weightKg: pw.value, updatedAt: nowIso() });
            toast({ message: 'Perfil guardado.', tone: 'ok' });
          }}
        >
          Guardar perfil
        </Button>
        <p className="text-xs text-faint">Estatura y peso no se usan para calcular cargas, metas, grasa corporal ni ajustes de máquinas.</p>
      </Card>
    </section>
  );
}

/* ---------- Preferencias ---------- */

function PrefsSection() {
  const prefs = usePrefs();
  if (!prefs) return null;
  const set = (p: Partial<Preferences>) => db.prefs.update('prefs', { ...p, updatedAt: nowIso() });
  return (
    <section>
      <SectionTitle>Preferencias</SectionTitle>
      <Card className="flex flex-col gap-2">
        <Field label="Nombre de la app" value={prefs.appName} onChange={(e) => set({ appName: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Select
            label="Tema"
            value={prefs.theme}
            onChange={(v) => set({ theme: v as Preferences['theme'] })}
            options={[
              { value: 'dark', label: 'Oscuro (grafito)' },
              { value: 'light', label: 'Claro' },
              { value: 'system', label: 'Según el sistema' },
            ]}
          />
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-muted">Color de acento</span>
            <input type="color" value={prefs.accent} onChange={(e) => set({ accent: e.target.value })} className="h-11 w-full rounded-lg border border-line bg-surface-2" />
          </label>
        </div>
        <Select
          label="Animaciones de la interfaz"
          value={prefs.animations}
          onChange={(v) => set({ animations: v as Preferences['animations'] })}
          options={[
            { value: 'system', label: 'Según el sistema (respeta movimiento reducido)' },
            { value: 'on', label: 'Activadas' },
            { value: 'off', label: 'Desactivadas' },
          ]}
        />
        <Toggle label="Reproducir demostraciones automáticamente" checked={prefs.autoplayDemos} onChange={(v) => set({ autoplayDemos: v })} hint="Desactivado por defecto. Nunca hay sonido." />
        <Toggle label="Iniciar descanso al confirmar una serie de trabajo" checked={prefs.autoStartRest} onChange={(v) => set({ autoStartRest: v })} />
        <Toggle label="Sonido al terminar el descanso" checked={prefs.restSound} onChange={(v) => set({ restSound: v })} hint="Depende del navegador; puede no sonar con el teléfono bloqueado." />
        <Toggle label="Vibración al terminar el descanso" checked={prefs.restVibration} onChange={(v) => set({ restVibration: v })} hint="Solo en navegadores compatibles." />
        <Toggle label="Mantener la pantalla encendida durante la sesión" checked={prefs.keepAwake} onChange={(v) => set({ keepAwake: v })} hint="Usa Wake Lock si el navegador lo permite." />
        <Select
          label="Recordatorio de respaldo"
          value={String(prefs.backupReminderDays)}
          onChange={(v) => set({ backupReminderDays: Number(v) })}
          options={[
            { value: '0', label: 'Nunca' },
            { value: '3', label: 'Cada 3 días' },
            { value: '7', label: 'Cada 7 días' },
            { value: '14', label: 'Cada 14 días' },
          ]}
        />
      </Card>
    </section>
  );
}

/* ---------- Respaldo e importación ---------- */

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
  const lastBackup = useLiveQuery(async () => (await db.meta.get('lastBackupAt'))?.value as string | undefined, []);
  const [incoming, setIncoming] = useState<BackupFile | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [policy, setPolicy] = useState<ImportPolicy>('merge-skip');
  const [backedUp, setBackedUp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wipe, setWipe] = useState(false);
  const [wipeText, setWipeText] = useState('');

  async function onFile(file: File | undefined) {
    setErrors([]);
    setPreview(null);
    setIncoming(null);
    setBackedUp(false);
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return setErrors(['El archivo supera 50 MB.']);
    const text = await file.text();
    const r = parseBackup(text);
    if (!r.ok) return setErrors(r.errors);
    setIncoming(r.data);
    setPreview(await previewImport(r.data, policy));
  }

  const needsBackup = policy !== 'merge-skip';

  return (
    <section id="respaldo">
      <SectionTitle>Datos y respaldo</SectionTitle>
      <Card className="flex flex-col gap-3">
        <p className="text-sm">
          Último respaldo: <strong>{lastBackup ? formatLocalDate(lastBackup.slice(0, 10), 'long') : 'nunca'}</strong>
        </p>
        <p className="text-sm text-muted">
          Tus datos se guardan solo en este navegador (IndexedDB). No es un respaldo, no está cifrado por ATLAS y no se sincroniza entre dispositivos: borrar los datos del sitio
          puede eliminar tu historial. Exporta un respaldo con regularidad y guárdalo donde quieras.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => downloadBackupNow().then(() => toast({ message: 'Respaldo descargado.', tone: 'ok' }))}>
            Exportar respaldo (JSON)
          </Button>
          <Button
            onClick={async () => {
              const { sessions, sets } = await exportCsv();
              downloadText(`atlas-sesiones-${stamp()}.csv`, sessions, 'text/csv');
              downloadText(`atlas-series-${stamp()}.csv`, sets, 'text/csv');
            }}
          >
            Exportar CSV (sesiones y series)
          </Button>
        </div>
        <p className="text-xs text-faint">
          El JSON incluye esquema versionado y todos tus registros. No incluye claves, tokens ni archivos de terceros. El CSV usa coma como separador, punto decimal, fechas
          ISO 8601 con desfase y neutraliza textos que parezcan fórmulas.
        </p>

        <div className="border-t border-line pt-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Importar respaldo</span>
            <input type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0])} className="text-sm" />
          </label>
          {errors.length > 0 && (
            <div className="mt-2 rounded-lg border border-danger p-2 text-sm text-danger" role="alert">
              <p className="font-semibold">El archivo no se importó (la base no se modificó):</p>
              <ul className="list-disc pl-5">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {preview && incoming && (
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <p>
                Respaldo del {formatLocalDate(incoming.exportedAt.slice(0, 10), 'long')} (esquema {incoming.schemaVersion}): {preview.totals.incoming} registros —{' '}
                {preview.totals.added} nuevos, {preview.totals.identical} idénticos, {preview.totals.conflicts} con el mismo id y contenido distinto.
                {policy === 'replace-all' && (
                  <strong className="block text-warn">Se eliminarán {preview.totals.removed} registros locales que no están en el archivo.</strong>
                )}
              </p>
              <details>
                <summary className="cursor-pointer text-accent">Detalle por tabla</summary>
                <table className="mt-1 w-full tabular">
                  <thead className="text-left text-muted">
                    <tr>
                      <th>Tabla</th>
                      <th>Nuevos</th>
                      <th>Idénticos</th>
                      <th>Conflictos</th>
                      {policy === 'replace-all' && <th>Se eliminan</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {USER_TABLES.filter((t) => (preview.tables[t]?.incoming ?? 0) > 0 || (preview.tables[t]?.removed ?? 0) > 0).map((t) => (
                      <tr key={t}>
                        <td>{t}</td>
                        <td>{preview.tables[t]!.added}</td>
                        <td>{preview.tables[t]!.identical}</td>
                        <td>{preview.tables[t]!.conflicts}</td>
                        {policy === 'replace-all' && <td>{preview.tables[t]!.removed}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
              <Select
                label="Política de conflictos"
                value={policy}
                onChange={(v) => {
                  setPolicy(v as ImportPolicy);
                  setBackedUp(false);
                  void previewImport(incoming, v as ImportPolicy).then(setPreview);
                }}
                options={[
                  { value: 'merge-skip', label: 'Añadir solo lo nuevo (conservar lo actual en conflictos)' },
                  { value: 'merge-replace', label: 'Añadir lo nuevo y reemplazar conflictos con el archivo' },
                  { value: 'replace-all', label: 'Reemplazar todos mis datos por el archivo' },
                ]}
              />
              {preview.activeSessionLocal && policy === 'replace-all' && <p className="text-warn">Tienes una sesión en curso: reemplazarlo todo la sustituirá por los datos del archivo.</p>}
              {needsBackup && (
                <Button onClick={() => downloadBackupNow().then(() => setBackedUp(true))}>{backedUp ? 'Respaldo previo descargado ✓' : '1. Descargar respaldo de mis datos actuales'}</Button>
              )}
              <Button
                variant="primary"
                busy={busy}
                disabled={needsBackup && !backedUp}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const r = await applyImport(incoming, policy);
                    toast({ message: `Importación completa: ${r.written} registros escritos.`, tone: 'ok' });
                    setIncoming(null);
                    setPreview(null);
                  } catch (e) {
                    const reason = e instanceof Error && e.message.startsWith('La importación') ? e.message : userMessage(e);
                    toast({ message: `${reason} La base quedó como estaba.`, tone: 'error' });
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {needsBackup ? '2. Aplicar importación' : 'Aplicar importación'}
              </Button>
            </div>
          )}
        </div>

        <div className="border-t border-line pt-3">
          <Button variant="ghost" onClick={() => setWipe(true)}>
            Borrar todos mis datos…
          </Button>
        </div>
      </Card>
      <Dialog
        open={wipe}
        onClose={() => setWipe(false)}
        title="Borrar todos los datos"
        footer={
          <Button
            variant="danger"
            disabled={wipeText !== 'BORRAR' || !backedUp}
            onClick={async () => {
              await db.transaction('rw', [...USER_TABLES.map((t) => db.table(t)), db.meta], async () => {
                for (const t of USER_TABLES) await db.table(t).clear();
                await db.meta.clear();
              });
              location.reload();
            }}
          >
            Borrar definitivamente
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>Esto elimina de este navegador tu historial, rutina, mediciones y ajustes. No se puede deshacer.</p>
          <Button onClick={() => downloadBackupNow().then(() => setBackedUp(true))}>{backedUp ? 'Respaldo descargado ✓' : '1. Descargar respaldo antes de borrar'}</Button>
          <Field label='2. Escribe "BORRAR" para confirmar' value={wipeText} onChange={(e) => setWipeText(e.target.value)} />
        </div>
      </Dialog>
    </section>
  );
}

/* ---------- Almacenamiento y offline ---------- */

function StorageSection() {
  const online = useOnline();
  const today = useToday();
  const toast = useToast();
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [sw, setSw] = useState<string>('comprobando…');
  const counts = useLiveQuery(async () => {
    const variants = (await db.variants.toArray()).filter((v) => !v.archived);
    const media = await db.media.toArray();
    return {
      missing: variants.filter((v) => !(v.clipId && CLIPS.has(v.clipId))).length,
      own: variants.filter((v) => v.clipId && CLIPS.has(v.clipId)).length,
      remote: media.filter((m) => m.rightsReviewStatus === 'authorized' && (!m.expiresAt || m.expiresAt >= today)).length,
      pending: media.filter((m) => m.rightsReviewStatus !== 'authorized' || (m.expiresAt && m.expiresAt < today)).length,
    };
  }, [today]);

  useEffect(() => {
    navigator.storage?.estimate?.().then(setEstimate).catch(() => setEstimate(null));
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((r) => setSw(r?.active ? 'activo: la app abre sin conexión' : 'no instalado todavía (abre la app con conexión una vez)'));
    } else setSw('no disponible en este navegador');
  }, []);

  const mb = (n?: number) => (n === undefined ? '—' : `${(n / 1024 / 1024).toFixed(1)} MB`);
  return (
    <section>
      <SectionTitle>Almacenamiento y uso sin conexión</SectionTitle>
      <Card className="flex flex-col gap-2 text-sm">
        <p>
          Conexión: <strong>{online ? 'en línea' : 'sin conexión'}</strong> · Service worker: <strong>{sw}</strong>
        </p>
        <ul className="flex flex-col gap-1">
          <li>✓ Tus datos: guardados localmente en este navegador.</li>
          <li>✓ Catálogo, rutina y técnica: disponibles sin conexión.</li>
          <li>✓ Demostraciones propias ({counts?.own ?? '…'} variantes): incluidas en la app, sin conexión tras la primera carga.</li>
          <li>{counts?.remote ? '⚠' : '–'} Medios externos autorizados: {counts?.remote ?? 0} (requieren conexión; no se guardan).</li>
          <li>
            {counts && counts.missing + counts.pending > 0 ? '⚠' : '✓'} Recursos faltantes o pendientes: {counts ? counts.missing : '…'} variantes sin demostración ·{' '}
            {counts?.pending ?? 0} medios pendientes o vencidos.
          </li>
        </ul>
        <p>
          Uso: <strong>{mb(estimate?.usage)}</strong> de una cuota aproximada de {mb(estimate?.quota)} · Almacenamiento persistente:{' '}
          <strong>{persisted === null ? 'no disponible' : persisted ? 'concedido' : 'no concedido'}</strong>
        </p>
        {persisted === false && navigator.storage?.persist && (
          <Button
            size="sm"
            onClick={async () => {
              const ok = await navigator.storage.persist();
              setPersisted(ok);
              toast({ message: ok ? 'El navegador concedió almacenamiento persistente.' : 'El navegador no lo concedió (puede depender del uso o de instalar la app).', tone: ok ? 'ok' : 'info' });
            }}
          >
            Solicitar almacenamiento persistente
          </Button>
        )}
        <p className="text-xs text-faint">El almacenamiento persistente reduce el riesgo de que el navegador borre datos por falta de espacio, pero no reemplaza un respaldo.</p>
      </Card>
    </section>
  );
}
