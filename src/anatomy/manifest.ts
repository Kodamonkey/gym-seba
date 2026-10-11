import type { MediaManifestEntry } from '../domain/media';
import type { ExerciseVariant } from '../domain/types';
import { CLIPS } from './clips';

/**
 * Manifiesto de las demostraciones propias. Son animaciones SVG generadas en código por
 * este proyecto: no incluyen medios de terceros, viajan con la app y funcionan offline.
 * La revisión biomecánica profesional NO se ha realizado.
 */

export const MANIFEST_VERIFIED_AT = '2026-10-11';

export function manifestEntryFor(variant: Pick<ExerciseVariant, 'id' | 'exerciseId' | 'clipId'>): MediaManifestEntry | null {
  const clip = variant.clipId ? CLIPS.get(variant.clipId) : undefined;
  if (!clip) return null;
  return {
    assetId: `atlas-clip:${clip.id}`,
    exerciseId: variant.exerciseId,
    variantId: variant.id,
    provider: 'ATLAS (propio)',
    sourceUrl: null,
    author: 'ATLAS — animación generada en código (src/anatomy)',
    license: 'Obra propia del proyecto; sin medios de terceros',
    licenseUrl: null,
    attribution: '',
    mediaType: 'svg-live-animation',
    deliveryMode: 'bundled-code',
    storagePolicy: 'bundled-offline',
    expiresAt: null,
    capabilities: {
      play: true,
      pause: true,
      restart: true,
      speed: true,
      scrub: true,
      expand: true,
      stabilizerLayer: true,
      phases: true,
      views: [clip.viewLabel],
      recolor: true,
      audio: false,
    },
    technicalReviewStatus: 'pending',
    rightsReviewStatus: 'own-work',
    correspondenceStatus: 'self-checked',
    lastVerifiedAt: MANIFEST_VERIFIED_AT,
    notes: clip.caption,
  };
}
