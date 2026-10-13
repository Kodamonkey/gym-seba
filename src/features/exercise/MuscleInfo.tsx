import { useState } from 'react';
import { regionsInView } from '../../anatomy/render';
import { CLIPS } from '../../anatomy/clips';
import type { ExerciseVariant, MuscleRole } from '../../domain/types';
import { MUSCLE_BY_ID } from '../../data/seed/muscles';

const ROLE_TITLE: Record<MuscleRole, string> = {
  target: 'Músculos objetivo',
  synergist: 'También participan',
  stabilizer: 'Estabilizadores',
};
const ROLE_SWATCH: Record<MuscleRole, string> = { target: 'legend-target', synergist: 'legend-syn', stabilizer: 'legend-stab' };
const ROLE_HINT: Record<MuscleRole, string> = {
  target: 'coral sólido',
  synergist: 'ámbar con rayas',
  stabilizer: 'azul con puntos (capa opcional)',
};

/** "Músculos implicados": nombres visibles y leyenda con patrón (no solo color). */
export function MuscleInfo({ variant }: { variant: ExerciseVariant }) {
  const clip = variant.clipId ? CLIPS.get(variant.clipId) : undefined;
  const visible = clip ? regionsInView(clip.view) : new Set<string>();
  const roles: MuscleRole[] = ['target', 'synergist', 'stabilizer'];
  return (
    <section aria-labelledby={`mi-${variant.id}`} className="flex flex-col gap-2">
      <h3 id={`mi-${variant.id}`} className="font-semibold">
        Músculos implicados
      </h3>
      {roles.map((role) => {
        const list = variant.muscles.filter((m) => m.role === role);
        if (list.length === 0) return null;
        return (
          <div key={role} className="flex items-start gap-2">
            <span className={`legend-swatch mt-0.5 ${ROLE_SWATCH[role]}`} aria-hidden />
            <div className="text-sm">
              <p className="font-medium">
                {ROLE_TITLE[role]} <span className="font-normal text-faint">({ROLE_HINT[role]})</span>
              </p>
              <ul className="text-muted">
                {list.map((m) => {
                  const muscle = MUSCLE_BY_ID.get(m.muscleId);
                  if (!muscle) return null;
                  const shown = muscle.regions.some((r) => visible.has(r));
                  return (
                    <li key={m.muscleId}>
                      {muscle.commonName} <span className="text-faint">— {muscle.anatomicalName}</span>
                      {clip && !shown && <span className="text-faint"> (no visible en esta vista)</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
      <div className="flex items-center gap-2 text-xs text-faint">
        <span className="legend-swatch legend-neutral" aria-hidden />
        Gris = no destacado (no significa inactivo).
      </div>
      <p className="text-xs text-faint">
        Representación anatómica orientativa, no medición individual.
        {variant.musclesReviewStatus === 'unreviewed' && ' Asociaciones redactadas por ATLAS, pendientes de revisión profesional.'}
      </p>
    </section>
  );
}

export function TechniqueInfo({ variant }: { variant: ExerciseVariant }) {
  const [more, setMore] = useState(false);
  const t = variant.technique;
  const hasMore = !!(t.more.breathing || t.more.adjustments || t.more.details);
  return (
    <section className="flex flex-col gap-1 text-sm">
      <h3 className="font-semibold">Técnica</h3>
      <p>
        <strong>Preparación:</strong> {t.setup}
      </p>
      <p>
        <strong>Ejecución:</strong> {t.execution}
      </p>
      <p>
        <strong>Evita:</strong> {t.avoid.join(' ')}
      </p>
      {hasMore && (
        <button type="button" className="min-h-11 self-start py-2 text-accent underline" aria-expanded={more} onClick={() => setMore((x) => !x)}>
          {more ? 'Ver menos' : 'Ver más'}
        </button>
      )}
      {more && (
        <div className="flex flex-col gap-1 text-muted">
          {t.more.breathing && (
            <p>
              <strong>Respiración:</strong> {t.more.breathing}
            </p>
          )}
          {t.more.adjustments && (
            <p>
              <strong>Ajustes:</strong> {t.more.adjustments}
            </p>
          )}
          {t.more.details && (
            <p>
              <strong>Detalles:</strong> {t.more.details}
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-faint">
        {t.authoredBy === 'atlas' ? 'Texto redactado por ATLAS' : 'Texto escrito por ti'} ·{' '}
        {t.reviewStatus === 'reviewed' ? 'revisado' : 'sin revisión profesional'}. Revisa la técnica con un entrenador al comenzar; detén la serie ante dolor
        inusual.
      </p>
    </section>
  );
}
