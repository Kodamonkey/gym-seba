import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { manifestEntryFor } from '../../anatomy/manifest';
import { useToday } from '../../app/hooks';
import { formatLocalDate } from '../../domain/dates';
import { CORRESPONDENCE_LABEL, RIGHTS_LABEL, TECH_LABEL, type ExternalMedia, type MediaType, type RightsStatus } from '../../domain/media';
import { computePRs, PR_LABEL } from '../../domain/pr';
import { formatDecimal } from '../../domain/validation';
import { db, nowIso, uid, userMessage } from '../../data/db';
import { prEntries } from '../../data/sessions';
import { Button, Card, Dialog, EmptyState, Field, Loading, Pill, Select } from '../../ui/primitives';
import { useToast } from '../../ui/toast';
import { DemoBlock } from '../exercise/DemoBlock';
import { MuscleInfo, TechniqueInfo } from '../exercise/MuscleInfo';
import { CreateVariantDialog } from './CreateVariantDialog';

export function VariantDetail() {
  const { variantId } = useParams();
  const toast = useToast();
  const variant = useLiveQuery(() => (variantId ? db.variants.get(variantId) : undefined), [variantId]);
  const equipment = useLiveQuery(() => (variantId ? db.equipment.where('variantIds').equals(variantId).toArray() : []), [variantId]);
  const media = useLiveQuery(() => (variantId ? db.media.where('variantId').equals(variantId).toArray() : []), [variantId]);
  const records = useLiveQuery(async () => {
    if (!variantId) return [];
    const entries = (await prEntries()).filter((e) => e.key.startsWith(`${variantId}|`));
    return computePRs(entries).bests;
  }, [variantId]);
  const [editTech, setEditTech] = useState(false);
  const [copy, setCopy] = useState(false);
  const [addMedia, setAddMedia] = useState(false);

  if (variant === undefined) return <Loading />;
  if (!variant) return <EmptyState title="Variante no encontrada" action={<Link to="/rutina?tab=biblioteca" className="text-accent underline">Volver a la biblioteca</Link>} />;
  const entry = manifestEntryFor(variant);
  const eqName = new Map((equipment ?? []).map((e) => [e.id, e.name]));

  return (
    <div className="flex flex-col gap-4">
      <Link to="/rutina?tab=biblioteca" className="text-sm text-accent underline">
        ← Biblioteca
      </Link>
      <h1 className="text-2xl font-bold">{variant.name}</h1>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <DemoBlock variant={variant} />
          <Card className="text-sm">
            <h2 className="mb-1 font-semibold">Estado del recurso visual</h2>
            {entry ? (
              <ul className="flex flex-col gap-1">
                <li>
                  Derechos: <Pill tone="ok">{RIGHTS_LABEL[entry.rightsReviewStatus]}</Pill>
                </li>
                <li>
                  Correspondencia: <Pill tone="info">{CORRESPONDENCE_LABEL[entry.correspondenceStatus]}</Pill>
                </li>
                <li>
                  Revisión técnica: <Pill tone="warn">{TECH_LABEL[entry.technicalReviewStatus]}</Pill>
                </li>
                <li className="text-faint">
                  {entry.provider} · {entry.mediaType} · {entry.storagePolicy} · verificado {entry.lastVerifiedAt}
                </li>
              </ul>
            ) : (
              <p className="text-muted">Sin demostración propia para esta variante.</p>
            )}
            {(media ?? []).map((m) => (
              <div key={m.id} className="mt-2 rounded-lg bg-surface-2 p-2">
                <p className="font-medium">{m.provider}</p>
                <p className="text-xs text-muted">
                  {RIGHTS_LABEL[m.rightsReviewStatus]} · {m.license} · {m.storagePolicy}
                  {m.expiresAt ? ` · vence ${m.expiresAt}` : ''}
                </p>
                <Button size="sm" variant="ghost" onClick={() => db.media.delete(m.id)}>
                  Quitar
                </Button>
              </div>
            ))}
            {!entry && (
              <Button size="sm" className="mt-2" onClick={() => setAddMedia(true)}>
                Incorporar medio autorizado
              </Button>
            )}
          </Card>
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="flex flex-col gap-4">
            <MuscleInfo variant={variant} />
            <TechniqueInfo variant={variant} />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setEditTech(true)}>
                Editar técnica
              </Button>
              <Button size="sm" onClick={() => setCopy(true)}>
                Crear variante a partir de esta
              </Button>
              {variant.custom && (
                <Button size="sm" variant="ghost" onClick={() => db.variants.update(variant.id, { archived: true, updatedAt: nowIso() }).then(() => toast({ message: 'Variante archivada (sus registros se conservan).', tone: 'ok' }))}>
                  Archivar
                </Button>
              )}
            </div>
          </Card>
          <Card>
            <h2 className="mb-2 font-semibold">Récords vigentes</h2>
            {records && records.length > 0 ? (
              <ul className="flex flex-col gap-1 text-sm">
                {records
                  .filter((r) => r.type !== 'reps-at-load')
                  .map((r) => {
                    const eqId = r.key.split('|')[1];
                    return (
                      <li key={`${r.key}-${r.type}`} className="flex flex-wrap justify-between gap-2">
                        <span>
                          {PR_LABEL[r.type]}
                          <span className="text-faint"> · {eqId === 'free' ? 'peso libre' : eqId === 'unidentified' ? 'máquina sin identificar' : (eqName.get(eqId ?? '') ?? 'otra máquina')}</span>
                        </span>
                        <Link to={`/historial/${r.sessionId}`} className="tabular text-accent underline">
                          {formatDecimal(r.value)}
                          {r.type === 'max-duration' ? ' s' : r.type === 'max-load' ? ' kg' : ' kg·rep'} · {formatLocalDate(r.date)}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            ) : (
              <p className="text-sm text-muted">Aún no hay series registradas de esta variante.</p>
            )}
            <p className="mt-2 text-xs text-faint">Récord de carga registrada en un contexto comparable; no mide fuerza fisiológica ni calidad técnica.</p>
          </Card>
          <Card className="text-sm">
            <h2 className="mb-1 font-semibold">Equipos</h2>
            {(equipment ?? []).length === 0 ? (
              <p className="text-muted">Sin equipo asociado.</p>
            ) : (
              <ul>
                {equipment!.map((e) => (
                  <li key={e.id}>
                    {e.name} <span className="text-faint">({e.status === 'available' ? 'disponible' : e.status === 'unavailable' ? 'no disponible' : 'por verificar'})</span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/rutina?tab=equipos" className="text-accent underline">
              Gestionar equipos
            </Link>
          </Card>
        </div>
      </div>
      <TechniqueDialog key={variant.updatedAt} open={editTech} onClose={() => setEditTech(false)} variantId={variant.id} initial={variant.technique} />
      <CreateVariantDialog open={copy} onClose={() => setCopy(false)} baseVariant={variant} />
      <MediaDialog open={addMedia} onClose={() => setAddMedia(false)} variantId={variant.id} exerciseId={variant.exerciseId} />
    </div>
  );
}

function TechniqueDialog({ open, onClose, variantId, initial }: { open: boolean; onClose: () => void; variantId: string; initial: { setup: string; execution: string; avoid: string[] } }) {
  const toast = useToast();
  const [setup, setSetup] = useState(initial.setup);
  const [execution, setExecution] = useState(initial.execution);
  const [avoid, setAvoid] = useState(initial.avoid.join('\n'));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Editar técnica"
      footer={
        <Button
          variant="primary"
          onClick={async () => {
            const v = await db.variants.get(variantId);
            if (!v) return;
            await db.variants.put({
              ...v,
              technique: { ...v.technique, setup, execution, avoid: avoid.split('\n').map((x) => x.trim()).filter(Boolean), authoredBy: 'user', reviewStatus: 'unreviewed' },
              updatedAt: nowIso(),
            });
            toast({ message: 'Técnica actualizada (marcada como texto tuyo, sin revisión).', tone: 'ok' });
            onClose();
          }}
        >
          Guardar
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Preparación" value={setup} onChange={(e) => setSetup(e.target.value)} />
        <Field label="Ejecución" value={execution} onChange={(e) => setExecution(e.target.value)} />
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Evita (una por línea)</span>
          <textarea className="min-h-20 rounded-lg border border-line bg-surface-2 p-2" value={avoid} onChange={(e) => setAvoid(e.target.value)} />
        </label>
      </div>
    </Dialog>
  );
}

/** Registro de un medio externo. Solo se reproduce con derechos "autorizado" y vigentes. */
function MediaDialog({ open, onClose, variantId, exerciseId }: { open: boolean; onClose: () => void; variantId: string; exerciseId: string }) {
  const toast = useToast();
  const today = useToday();
  const [url, setUrl] = useState('');
  const [type, setType] = useState<MediaType>('video/mp4');
  const [provider, setProvider] = useState('');
  const [license, setLicense] = useState('');
  const [licenseUrl, setLicenseUrl] = useState('');
  const [attribution, setAttribution] = useState('');
  const [rights, setRights] = useState<RightsStatus>('pending');
  const [expires, setExpires] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return setErr('La URL no es válida.');
    }
    if (parsed.protocol !== 'https:') return setErr('Solo se admiten URLs https.');
    if (!provider.trim() || !license.trim()) return setErr('Indica proveedor y licencia.');
    const now = nowIso();
    const m: ExternalMedia = {
      id: uid(),
      assetId: `ext:${uid()}`,
      exerciseId,
      variantId,
      provider: provider.trim(),
      sourceUrl: parsed.toString(),
      author: provider.trim(),
      license: license.trim(),
      licenseUrl: licenseUrl.trim() || null,
      attribution: attribution.trim(),
      mediaType: type,
      deliveryMode: 'remote-url',
      storagePolicy: 'stream-only',
      expiresAt: expires || null,
      capabilities: { play: type !== 'image/gif', pause: type !== 'image/gif', restart: type !== 'image/gif', speed: type !== 'image/gif', scrub: type !== 'image/gif', expand: false, stabilizerLayer: false, phases: false, views: ['única'], recolor: false, audio: false },
      technicalReviewStatus: 'pending',
      rightsReviewStatus: rights,
      correspondenceStatus: 'pending',
      lastVerifiedAt: today,
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    try {
      await db.media.add(m);
      toast({ message: rights === 'authorized' ? 'Medio registrado.' : 'Medio registrado como pendiente: no se mostrará hasta autorizarlo.', tone: 'ok' });
      onClose();
    } catch (e) {
      setErr(userMessage(e));
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Incorporar medio autorizado" footer={<Button variant="primary" onClick={save}>Guardar</Button>}>
      <div className="flex flex-col gap-3 text-sm">
        <p className="text-muted">
          Solo incorpora medios cuya licencia permita este uso. El archivo no se descarga ni se guarda: se reproduce desde su origen (implica conexión a ese tercero). No uses
          previsualizaciones ni medios con marca de agua eliminada.
        </p>
        <Field label="URL https del vídeo o imagen" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Select label="Formato" value={type} onChange={(v) => setType(v as MediaType)} options={[{ value: 'video/mp4', label: 'MP4' }, { value: 'video/webm', label: 'WebM' }, { value: 'image/gif', label: 'GIF' }]} />
        <Field label="Proveedor" value={provider} onChange={(e) => setProvider(e.target.value)} />
        <Field label="Licencia" value={license} onChange={(e) => setLicense(e.target.value)} />
        <Field label="URL de la licencia" value={licenseUrl} onChange={(e) => setLicenseUrl(e.target.value)} />
        <Field label="Atribución requerida" value={attribution} onChange={(e) => setAttribution(e.target.value)} />
        <Select
          label="Estado de derechos"
          value={rights}
          onChange={(v) => setRights(v as RightsStatus)}
          options={[
            { value: 'pending', label: 'Pendiente de autorización' },
            { value: 'authorized', label: 'Autorizado (licencia verificada)' },
          ]}
        />
        <Field label="Vence (opcional)" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
        {err && (
          <p className="text-danger" role="alert">
            {err}
          </p>
        )}
      </div>
    </Dialog>
  );
}
