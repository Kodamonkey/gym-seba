import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router';
import { CLIPS } from '../../anatomy/clips';
import { manifestEntryFor } from '../../anatomy/manifest';
import { regionsInView } from '../../anatomy/render';
import { CORRESPONDENCE_LABEL, RIGHTS_LABEL, TECH_LABEL } from '../../domain/media';
import { db } from '../../data/db';
import { MUSCLE_BY_ID } from '../../data/seed/muscles';
import { Card, Loading, Pill, SectionTitle } from '../../ui/primitives';

export const REFERENCES = [
  { id: 'R1', title: 'FitnessProgramer — referencia de presentación aportada por el usuario', url: 'https://fitnessprogramer.com/workout/add-aff-agg/', use: 'Solo como referencia de organización de fichas. No se importó su rutina ni sus medios.' },
  { id: 'R2', title: 'FitnessProgramer — condiciones', url: 'https://fitnessprogramer.com/terms-and-conditions/', use: 'Una página visible no implica permiso de redistribución: no se reutilizó texto ni imágenes.' },
  { id: 'R3', title: 'Hevy — funciones de producto', url: 'https://www.hevyapp.com/features/', use: 'Referencia funcional de registro por serie, valores previos, descansos y PR. No se copió su interfaz.' },
  { id: 'R4', title: 'GymVisual — términos y licencia de medios', url: 'https://gymvisual.com/content/3-terms-and-conditions-of-use', use: 'No se compraron ni incorporaron medios (decisión "sin pagos").' },
  { id: 'R5', title: 'Muscle & Motion — uso de contenido y licencias comerciales', url: 'https://www.muscleandmotion.com/knowledge-center/content-usage/', use: 'Sin licencia de integración: no se incorporaron medios.' },
  { id: 'R6', title: 'MuscleWiki API — términos de uso', url: 'https://api.musclewiki.com/api-terms', use: 'No se usa: restringe descarga/almacenamiento de vídeo y requiere credenciales.' },
  { id: 'R7', title: 'wger — documentación oficial', url: 'https://wger.readthedocs.io/en/latest/', use: 'Evaluado como catálogo; no aporta animaciones anatómicas con equipo para estas variantes. No integrado.' },
  { id: 'R8', title: 'MDN — IndexedDB API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API', use: 'Almacenamiento estructurado y transacciones.' },
  { id: 'R9', title: 'W3C — Understanding SC 1.4.1: Use of Color', url: 'https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html', use: 'Roles musculares con patrón + nombre; estados del calendario con texto y símbolo.' },
  { id: 'R10', title: 'MDN — HTMLMediaElement.playbackRate', url: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/playbackRate', use: 'Control de velocidad en medios externos compatibles.' },
  { id: 'R11', title: 'MDN — Service Worker API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API', use: 'Shell y código propio en caché; sin caché de terceros.' },
  { id: 'R12', title: 'MDN — StorageManager', url: 'https://developer.mozilla.org/en-US/docs/Web/API/StorageManager', use: 'Estimación de cuota y solicitud de persistencia.' },
  { id: 'R13', title: 'Dexie — documentación oficial', url: 'https://dexie.org/docs', use: 'Adaptador de IndexedDB; sin sincronización en la nube.' },
];

/** Fuentes, licencias, manifiesto de medios y matriz de cobertura de demostraciones. */
export function SourcesPage() {
  const data = useLiveQuery(async () => {
    const program = await db.programs.where('status').equals('active').first();
    const template = program ? await db.routineTemplates.get(program.templateId) : (await db.routineTemplates.toArray())[0];
    const variants = await db.variants.toArray();
    const media = await db.media.toArray();
    return { template, variants, media };
  }, []);
  if (!data) return <Loading />;
  const vById = new Map(data.variants.map((v) => [v.id, v]));
  const rows: { id: string; role: string; day: string }[] = [];
  for (const d of data.template?.days ?? []) {
    for (const ex of d.exercises) {
      rows.push({ id: ex.variantId, role: 'Principal', day: d.name });
      for (const a of ex.alternativeVariantIds) rows.push({ id: a, role: 'Alternativa', day: d.name });
    }
  }
  const seen = new Set<string>();
  const unique = rows.filter((r) => (seen.has(`${r.id}`) ? false : (seen.add(r.id), true)));

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold">Fuentes, licencias y cobertura</h1>
      <Card className="flex flex-col gap-2 text-sm">
        <p>
          Las demostraciones son <strong>animaciones SVG propias</strong>, generadas en código por esta app (sin medios de terceros, sin compras ni licencias externas). Muestran
          una persona con el equipo y los músculos resaltados sobre su propio cuerpo. Son una <strong>representación orientativa</strong>: la{' '}
          <strong>revisión biomecánica profesional está pendiente</strong> para todas. Los textos de técnica y las asociaciones musculares fueron redactados por ATLAS y tampoco
          tienen revisión profesional.
        </p>
        <p className="text-muted">Colores: coral = objetivo, ámbar con rayas = también participa, azul con puntos = estabilizador (capa opcional), gris = no destacado.</p>
      </Card>

      <section>
        <SectionTitle>Matriz de cobertura (rutina actual)</SectionTitle>
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[46rem] text-left text-xs">
            <thead className="bg-surface-2 text-muted">
              <tr>
                <th className="p-2">Variante</th>
                <th className="p-2">Uso</th>
                <th className="p-2">Recurso</th>
                <th className="p-2">Vista</th>
                <th className="p-2">Derechos</th>
                <th className="p-2">Offline</th>
                <th className="p-2">Objetivo no visible</th>
                <th className="p-2">Técnica</th>
              </tr>
            </thead>
            <tbody>
              {unique.map((r) => {
                const v = vById.get(r.id);
                const entry = v ? manifestEntryFor(v) : null;
                const clip = v?.clipId ? CLIPS.get(v.clipId) : undefined;
                const visible = clip ? regionsInView(clip.view) : new Set<string>();
                const hidden = (v?.muscles ?? []).filter((m) => m.role === 'target' && !(MUSCLE_BY_ID.get(m.muscleId)?.regions ?? []).some((x) => visible.has(x)));
                return (
                  <tr key={r.id} className="border-t border-line">
                    <td className="p-2">
                      <Link to={`/biblioteca/${r.id}`} className="underline">
                        {v?.name ?? r.id}
                      </Link>
                    </td>
                    <td className="p-2">
                      {r.role} · {r.day}
                    </td>
                    <td className="p-2">{entry ? 'Animación SVG propia' : <Pill tone="warn">Falta</Pill>}</td>
                    <td className="p-2">{clip?.viewLabel ?? '—'}</td>
                    <td className="p-2">{entry ? RIGHTS_LABEL[entry.rightsReviewStatus] : '—'}</td>
                    <td className="p-2">{entry ? 'Sí (incluida)' : '—'}</td>
                    <td className="p-2">{hidden.length ? hidden.map((m) => MUSCLE_BY_ID.get(m.muscleId)?.commonName).join(', ') : 'Ninguno'}</td>
                    <td className="p-2">{entry ? TECH_LABEL[entry.technicalReviewStatus] : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <SectionTitle>Manifiesto de medios</SectionTitle>
        <Card className="flex flex-col gap-2 text-xs">
          <p className="text-sm text-muted">
            Cada recurso declara proveedor, licencia, modo de entrega, política de almacenamiento, capacidades y tres revisiones separadas (derechos, correspondencia y técnica).
          </p>
          <ul className="flex flex-col gap-2">
            {data.variants
              .filter((v) => v.clipId && CLIPS.has(v.clipId))
              .slice(0, 50)
              .map((v) => {
                const e = manifestEntryFor(v)!;
                return (
                  <li key={v.id} className="rounded-lg bg-surface-2 p-2">
                    <p className="font-semibold">{v.name}</p>
                    <p className="text-muted">
                      {e.assetId} · {e.provider} · {e.mediaType} · {e.deliveryMode} · {e.storagePolicy} · {RIGHTS_LABEL[e.rightsReviewStatus]} ·{' '}
                      {CORRESPONDENCE_LABEL[e.correspondenceStatus]} · {TECH_LABEL[e.technicalReviewStatus]} · verificado {e.lastVerifiedAt}
                    </p>
                  </li>
                );
              })}
            {data.media.map((m) => (
              <li key={m.id} className="rounded-lg bg-surface-2 p-2">
                <p className="font-semibold">{vById.get(m.variantId)?.name} (medio externo)</p>
                <p className="text-muted">
                  {m.provider} · {m.license} · {m.mediaType} · {m.storagePolicy} · {RIGHTS_LABEL[m.rightsReviewStatus]} · {TECH_LABEL[m.technicalReviewStatus]}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <SectionTitle>Referencias consultadas (11 de octubre de 2026)</SectionTitle>
        <Card>
          <ul className="flex flex-col gap-2 text-sm">
            {REFERENCES.map((r) => (
              <li key={r.id}>
                <span className="font-semibold">[{r.id}]</span>{' '}
                <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                  {r.title}
                </a>
                <span className="block text-xs text-muted">{r.use}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-faint">Son referencias del encargo, no autorizaciones de uso. ATLAS no tiene relación con Smart Fit ni con ninguno de estos proveedores.</p>
        </Card>
      </section>
    </div>
  );
}
