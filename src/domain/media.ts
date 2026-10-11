import type { ID, Instant, LocalDate } from './types';

/**
 * Manifiesto de medios. Los tres controles son independientes:
 * - rightsReviewStatus: ¿hay derecho a usarlo así? (legal/licencia)
 * - correspondenceStatus: ¿muestra exactamente esta variante, equipo, agarre y lateralidad?
 * - technicalReviewStatus: ¿la técnica y la anatomía fueron revisadas por un profesional?
 */

export type RightsStatus = 'own-work' | 'authorized' | 'pending' | 'rejected' | 'expired';
export type CorrespondenceStatus = 'self-checked' | 'pending' | 'mismatch';
export type TechnicalReviewStatus = 'pending' | 'reviewed' | 'changes-requested';

export type MediaType = 'svg-live-animation' | 'video/mp4' | 'video/webm' | 'image/gif';
export type DeliveryMode = 'bundled-code' | 'remote-url' | 'embed';
export type StoragePolicy = 'bundled-offline' | 'stream-only' | 'cache-allowed' | 'no-store';

export interface MediaCapabilities {
  play: boolean;
  pause: boolean;
  restart: boolean;
  speed: boolean;
  scrub: boolean;
  expand: boolean;
  /** Mostrar/ocultar la capa de estabilizadores (solo si el render es en vivo). */
  stabilizerLayer: boolean;
  /** Etiquetas de fase propias del clip. */
  phases: boolean;
  /** Vistas disponibles; un recurso de un solo ángulo no simula otros. */
  views: string[];
  /** Si el resaltado puede recolorearse u ocultarse (falso si el color está integrado en un vídeo). */
  recolor: boolean;
  audio: boolean;
}

export interface MediaManifestEntry {
  assetId: ID;
  exerciseId: ID;
  variantId: ID;
  provider: string;
  sourceUrl: string | null;
  author: string;
  license: string;
  licenseUrl: string | null;
  attribution: string;
  mediaType: MediaType;
  deliveryMode: DeliveryMode;
  storagePolicy: StoragePolicy;
  expiresAt: LocalDate | null;
  capabilities: MediaCapabilities;
  technicalReviewStatus: TechnicalReviewStatus;
  rightsReviewStatus: RightsStatus;
  correspondenceStatus: CorrespondenceStatus;
  lastVerifiedAt: LocalDate;
  notes: string;
}

/** Medio externo que el usuario incorpora (p. ej. un vídeo con licencia). Se guarda en IndexedDB. */
export interface ExternalMedia extends MediaManifestEntry {
  id: ID;
  createdAt: Instant;
  updatedAt: Instant;
}

/** ¿Se puede mostrar el medio? Solo con derechos vigentes. */
export function isPlayable(m: Pick<MediaManifestEntry, 'rightsReviewStatus' | 'expiresAt'>, today: LocalDate): boolean {
  if (m.rightsReviewStatus !== 'own-work' && m.rightsReviewStatus !== 'authorized') return false;
  if (m.expiresAt && m.expiresAt < today) return false;
  return true;
}

export const RIGHTS_LABEL: Record<RightsStatus, string> = {
  'own-work': 'Obra propia',
  authorized: 'Autorizado',
  pending: 'Pendiente de autorización',
  rejected: 'Sin autorización',
  expired: 'Licencia vencida',
};

export const TECH_LABEL: Record<TechnicalReviewStatus, string> = {
  pending: 'Revisión técnica pendiente',
  reviewed: 'Revisado técnicamente',
  'changes-requested': 'Requiere cambios técnicos',
};

export const CORRESPONDENCE_LABEL: Record<CorrespondenceStatus, string> = {
  'self-checked': 'Correspondencia verificada por el autor',
  pending: 'Correspondencia pendiente',
  mismatch: 'No corresponde a la variante',
};
