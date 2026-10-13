import { useCallback } from 'react';
import { AnatomyPlayer, useRoleMap } from '../../anatomy/AnatomyPlayer';
import { CLIPS } from '../../anatomy/clips';
import { usePrefs, usePrefersReducedMotion } from '../../app/hooks';
import type { ExerciseVariant } from '../../domain/types';
import { MUSCLE_BY_ID } from '../../data/seed/muscles';

/**
 * Demostración de la variante exacta (animación anatómica propia). Si no hay, lo dice sin
 * sustituirla por otro movimiento; el registro de series funciona igual.
 */
export function DemoBlock({ variant, compact }: { variant: ExerciseVariant; compact?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const prefs = usePrefs();
  const regionsOf = useCallback((id: string) => MUSCLE_BY_ID.get(id)?.regions ?? [], []);
  const roles = useRoleMap(variant.muscles, regionsOf);
  const clip = variant.clipId ? CLIPS.get(variant.clipId) : undefined;

  if (!clip) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center rounded-2xl bg-surface-2 p-4 text-center text-sm text-muted" role="note">
        Sin demostración para este ejercicio.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1 overflow-hidden rounded-2xl bg-surface-2">
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
      <p className="px-3 pb-2 text-xs text-muted">Animación orientativa propia · revisión biomecánica profesional pendiente.</p>
    </div>
  );
}
