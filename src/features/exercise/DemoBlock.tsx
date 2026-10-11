import { useLiveQuery } from 'dexie-react-hooks';
import { useCallback } from 'react';
import { Link } from 'react-router';
import { AnatomyPlayer, useRoleMap } from '../../anatomy/AnatomyPlayer';
import { CLIPS } from '../../anatomy/clips';
import { usePrefersReducedMotion, usePrefs, useToday } from '../../app/hooks';
import { isPlayable, RIGHTS_LABEL } from '../../domain/media';
import type { ExerciseVariant } from '../../domain/types';
import { db } from '../../data/db';
import { MUSCLE_BY_ID } from '../../data/seed/muscles';
import { VideoPlayer } from './VideoPlayer';

/**
 * Demostración de la variante exacta. Si no hay recurso, lo dice sin sustituirlo
 * por otro movimiento; el registro de series funciona igual.
 */
export function DemoBlock({ variant, compact }: { variant: ExerciseVariant; compact?: boolean }) {
  const prefs = usePrefs();
  const reduced = usePrefersReducedMotion();
  const today = useToday();
  const regionsOf = useCallback((id: string) => MUSCLE_BY_ID.get(id)?.regions ?? [], []);
  const roles = useRoleMap(variant.muscles, regionsOf);
  const external = useLiveQuery(() => db.media.where('variantId').equals(variant.id).toArray(), [variant.id]);
  const clip = variant.clipId ? CLIPS.get(variant.clipId) : undefined;

  if (clip) {
    return (
      <div className="flex flex-col gap-1">
        <AnatomyPlayer
          key={clip.id}
          clip={clip}
          roles={roles}
          hasStabilizers={variant.muscles.some((m) => m.role === 'stabilizer')}
          autoplay={prefs?.autoplayDemos ?? false}
          reducedMotion={reduced}
          label={variant.name}
          {...(compact ? { compact } : {})}
        />
        <p className="px-2 text-xs text-faint">
          {clip.caption} Animación propia de ATLAS (obra propia, disponible sin conexión) · revisión biomecánica profesional pendiente.
        </p>
      </div>
    );
  }

  const playable = (external ?? []).find((m) => isPlayable(m, today));
  if (playable) return <VideoPlayer media={playable} label={variant.name} />;

  const pending = (external ?? [])[0];
  return (
    <div className="flex aspect-[16/10] flex-col items-start justify-center gap-2 rounded-xl border border-dashed border-line p-4" role="note">
      <p className="font-semibold">Demostración no disponible para esta variante</p>
      <p className="text-sm text-muted">
        {pending
          ? `Hay un medio registrado, pero su estado es: ${RIGHTS_LABEL[pending.rightsReviewStatus]}. No se muestra hasta que esté autorizado y vigente.`
          : 'No se muestra la animación de otro ejercicio en su lugar. Puedes registrar tus series igualmente.'}
      </p>
      <Link to={`/biblioteca/${variant.id}`} className="text-sm text-accent underline">
        Incorporar un medio autorizado
      </Link>
    </div>
  );
}
