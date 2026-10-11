import type { PrescribedExercise, RoutineDay, RoutineTemplate } from '../../domain/types';

/**
 * Rutina inicial acordada para la app (8 semanas, 4 días). No es una prescripción médica
 * ni un programa validado profesionalmente. Todo es editable desde "Mi rutina".
 */

const SEED_TIME = '2026-10-11T00:00:00.000Z';

function ex(
  id: string,
  variantId: string,
  sets: number,
  repMin: number,
  repMax: number,
  restSec: number,
  alternativeVariantIds: string[],
  extra: Partial<PrescribedExercise> = {},
): PrescribedExercise {
  return {
    id,
    variantId,
    sets,
    repMin,
    repMax,
    repsMode: 'total',
    restSec,
    rirMin: 2,
    rirMax: 3,
    alternativeVariantIds,
    notes: '',
    ...extra,
  };
}

const SPLIT = { warmupMin: 7, strengthMin: 40, cardioMin: 10, cooldownMin: 3 };

const DAYS: RoutineDay[] = [
  {
    id: 'day-upper-a',
    name: 'Tren superior A',
    weekday: 1,
    timeSplit: SPLIT,
    exercises: [
      ex('ua-1', 'v-chest-press-machine', 3, 8, 12, 90, ['v-db-bench-press']),
      ex('ua-2', 'v-lat-pulldown-wide', 3, 8, 12, 90, ['v-lat-pulldown-supine', 'v-lat-pulldown-neutral']),
      ex('ua-3', 'v-seated-row-machine', 2, 10, 12, 75, ['v-seated-cable-row']),
      ex('ua-4', 'v-shoulder-press-machine', 2, 8, 12, 75, ['v-db-seated-shoulder-press']),
      ex('ua-5', 'v-db-lateral-raise', 2, 12, 15, 60, ['v-cable-lateral-raise']),
      ex('ua-6', 'v-triceps-pushdown', 2, 10, 15, 60, ['v-triceps-extension-machine']),
    ],
  },
  {
    id: 'day-lower-a',
    name: 'Tren inferior A',
    weekday: 2,
    timeSplit: SPLIT,
    exercises: [
      ex('la-1', 'v-leg-press', 3, 10, 12, 90, ['v-goblet-squat']),
      ex('la-2', 'v-db-rdl', 3, 8, 10, 90, ['v-bb-rdl']),
      ex('la-3', 'v-lying-leg-curl', 2, 10, 15, 75, ['v-seated-leg-curl']),
      ex('la-4', 'v-leg-extension', 2, 10, 15, 60, [], {
        noDirectAlternativeNote:
          'No hay una sustitución directa definida para la extensión de cuádriceps. Si tu sede tiene otra máquina equivalente, créala como variante identificada.',
      }),
      ex('la-5', 'v-standing-calf-machine', 2, 12, 15, 60, ['v-db-calf-raise', 'v-smith-calf-raise']),
      ex('la-6', 'v-pallof-press', 2, 10, 10, 60, ['v-pallof-hold'], { repsMode: 'per-side', durationMin: 20, durationMax: 30 }),
    ],
  },
  {
    id: 'day-upper-b',
    name: 'Tren superior B',
    weekday: 4,
    timeSplit: SPLIT,
    exercises: [
      ex('ub-1', 'v-incline-db-press', 3, 8, 12, 90, ['v-incline-press-machine']),
      ex('ub-2', 'v-lat-pulldown-neutral', 3, 8, 12, 90, ['v-lat-pulldown-wide', 'v-lat-pulldown-supine']),
      ex('ub-3', 'v-chest-supported-row', 2, 10, 12, 75, ['v-seated-row-machine']),
      ex('ub-4', 'v-reverse-pec-deck', 2, 12, 15, 60, ['v-cable-reverse-fly']),
      ex('ub-5', 'v-cable-lateral-raise', 2, 12, 15, 60, ['v-db-lateral-raise'], { repsMode: 'per-side' }),
      ex('ub-6', 'v-cable-curl', 2, 10, 15, 60, ['v-db-curl']),
    ],
  },
  {
    id: 'day-lower-b',
    name: 'Tren inferior B',
    weekday: 6,
    timeSplit: SPLIT,
    exercises: [
      ex('lb-1', 'v-smith-squat', 3, 8, 12, 90, ['v-leg-press']),
      ex('lb-2', 'v-hip-thrust-machine', 3, 8, 12, 90, ['v-smith-hip-thrust']),
      ex('lb-3', 'v-seated-leg-curl', 2, 10, 12, 75, ['v-lying-leg-curl']),
      ex('lb-4', 'v-db-split-squat', 2, 8, 8, 75, ['v-smith-split-squat'], { repsMode: 'per-side' }),
      ex('lb-5', 'v-standing-calf-machine', 2, 12, 15, 60, ['v-db-calf-raise']),
      ex('lb-6', 'v-cable-crunch', 2, 10, 15, 60, ['v-ab-crunch-machine']),
    ],
  },
];

export const ROUTINE_TEMPLATE: RoutineTemplate = {
  id: 'rt-atlas-4d',
  name: 'ATLAS 4 días — superior/inferior',
  weeksTotal: 8,
  adaptation: { weeks: 2, setsPerExercise: 2 },
  days: DAYS,
  version: 1,
  archived: false,
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
};
