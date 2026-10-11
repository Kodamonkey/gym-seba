import { mkdirSync, writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { CLIPS } from '../src/anatomy/clips';
import { manifestEntryFor } from '../src/anatomy/manifest';
import { regionsInView } from '../src/anatomy/render';
import { CORRESPONDENCE_LABEL, RIGHTS_LABEL, TECH_LABEL } from '../src/domain/media';
import { VARIANT_BY_ID, VARIANTS } from '../src/data/seed/catalog';
import { MUSCLE_BY_ID } from '../src/data/seed/muscles';
import { ROUTINE_TEMPLATE } from '../src/data/seed/routine';

/**
 * Genera docs/COVERAGE_MATRIX.md y docs/MEDIA_MANIFEST.md a partir del código.
 * Solo se ejecuta con ATLAS_GEN_DOCS=1 (script `npm run docs:media`).
 */
it.skipIf(process.env.ATLAS_GEN_DOCS !== '1')('genera la matriz de cobertura y el manifiesto', () => {
  mkdirSync('docs', { recursive: true });
  const muscleNames = (ids: string[]) => ids.map((id) => MUSCLE_BY_ID.get(id)?.commonName ?? id).join(', ');

  const rows: string[] = [];
  const seen = new Set<string>();
  for (const day of ROUTINE_TEMPLATE.days) {
    for (const ex of day.exercises) {
      const entries: [string, string][] = [[ex.variantId, 'Principal'], ...ex.alternativeVariantIds.map((a) => [a, 'Alternativa'] as [string, string])];
      for (const [id, role] of entries) {
        const v = VARIANT_BY_ID.get(id)!;
        const clip = v.clipId ? CLIPS.get(v.clipId) : undefined;
        const e = manifestEntryFor(v);
        const visible = clip ? regionsInView(clip.view) : new Set<string>();
        const targets = v.muscles.filter((m) => m.role === 'target').map((m) => m.muscleId);
        const hidden = targets.filter((t) => !(MUSCLE_BY_ID.get(t)?.regions ?? []).some((r) => visible.has(r)));
        const syn = v.muscles.filter((m) => m.role === 'synergist').map((m) => m.muscleId);
        rows.push(
          `| ${v.name} | ${role} · ${day.name}${seen.has(id) ? ' (repetida)' : ''} | ${e ? 'Animación SVG propia' : '**Falta**'} | ${clip?.viewLabel ?? '—'} | ${
            e ? RIGHTS_LABEL[e.rightsReviewStatus] : '—'
          } | ${e ? 'Sí (incluida en la app)' : '—'} | ${muscleNames(targets)} | ${muscleNames(syn) || '—'} | ${hidden.length ? muscleNames(hidden) : 'ninguno'} | ${
            e ? TECH_LABEL[e.technicalReviewStatus] : '—'
          } | ${ex.noDirectAlternativeNote && role === 'Principal' ? 'Sin sustitución directa definida' : '—'} |`,
        );
        seen.add(id);
      }
    }
  }

  const matrix = `# Matriz de cobertura de demostraciones

Generado desde el código (\`npm run docs:media\`). Fecha de verificación de los recursos: ${manifestEntryFor(VARIANTS[0]!)!.lastVerifiedAt}.

Todas las demostraciones son **animaciones SVG propias** renderizadas en vivo (persona + equipo + músculos resaltados sobre el propio cuerpo). No se usaron medios de terceros. **Ninguna tiene revisión biomecánica profesional.**

Columnas: recurso, tipo, derechos, disponibilidad offline, músculos objetivo y colaboradores (asociaciones redactadas por ATLAS, sin revisión), músculos objetivo que no se ven en esa vista (se rotulan en la interfaz), estado técnico y faltantes.

| Variante | Uso en la rutina | Recurso | Vista | Derechos | Offline | Objetivo | También participan | Objetivo no visible en la vista | Revisión técnica | Faltantes |
|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## Variantes del catálogo fuera de la rutina actual

${VARIANTS.filter((v) => !seen.has(v.id))
  .map((v) => `- ${v.name}: ${manifestEntryFor(v) ? 'animación SVG propia' : 'sin demostración'}`)
  .join('\n') || '- Ninguna.'}

## Faltantes conocidos

- Revisión biomecánica profesional de las ${CLIPS.size} animaciones, de los textos de técnica y de las asociaciones musculares.
- La extensión de cuádriceps no tiene una sustitución directa definida; una "otra máquina equivalente" debe crearse como variante identificada (quedará sin demostración hasta incorporar un medio autorizado).
- Vistas adicionales (segundo ángulo, rotación 3D): no implementadas; cada clip declara una sola vista.
`;
  writeFileSync('docs/COVERAGE_MATRIX.md', matrix);

  const manifest = VARIANTS.map((v) => manifestEntryFor(v))
    .filter((e) => e !== null)
    .map((e) => ({ ...e }));
  const md = `# Manifiesto de medios

Generado desde \`src/anatomy/manifest.ts\` (\`npm run docs:media\`). Cada entrada tiene tres revisiones separadas: derechos (\`rightsReviewStatus\`), correspondencia con la variante (\`correspondenceStatus\`) y revisión técnica (\`technicalReviewStatus\`).

## Política de almacenamiento

- **Animaciones propias** (\`bundled-code\` / \`bundled-offline\`): son código del proyecto; viajan en el bundle y el service worker las precachea. Sin restricciones de terceros.
- **Medios externos** que el usuario registre (\`remote-url\` / \`stream-only\`): solo se reproducen si están marcados como autorizados y vigentes; nunca se descargan, no se precachean y no se incluyen en los respaldos (solo sus metadatos).
- No se usan previsualizaciones, scraping, hotlinking restringido ni medios con marca de agua eliminada.

## Resumen

| assetId | variantId | provider | mediaType | deliveryMode | storagePolicy | license | rights | correspondence | technical | lastVerifiedAt |
|---|---|---|---|---|---|---|---|---|---|---|
${manifest
  .map(
    (e) =>
      `| ${e.assetId} | ${e.variantId} | ${e.provider} | ${e.mediaType} | ${e.deliveryMode} | ${e.storagePolicy} | ${e.license} | ${RIGHTS_LABEL[e.rightsReviewStatus]} | ${CORRESPONDENCE_LABEL[e.correspondenceStatus]} | ${TECH_LABEL[e.technicalReviewStatus]} | ${e.lastVerifiedAt} |`,
  )
  .join('\n')}

## Entradas completas (JSON)

\`\`\`json
${JSON.stringify(manifest, null, 2)}
\`\`\`
`;
  writeFileSync('docs/MEDIA_MANIFEST.md', md);
});
