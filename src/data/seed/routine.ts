import type { PrescribedExercise, RoutineDay, RoutineTemplate } from '../../domain/types';

/**
 * Rutina inicial acordada para la app (8 semanas, 4 días), ajustada con literatura y alternativas.
 * No es una prescripción médica ni un programa validado profesionalmente. La interfaz mínima
 * permite cambiar la variante durante una sesión; no incluye un editor de la plantilla.
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
      ex('ua-1', 'v-chest-press-machine', 3, 8, 12, 120, ['v-db-bench-press']),
      ex('ua-2', 'v-lat-pulldown-neutral', 3, 8, 12, 120, ['v-lat-pulldown-wide', 'v-lat-pulldown-supine']),
      ex('ua-3', 'v-seated-row-machine', 2, 10, 12, 90, ['v-seated-cable-row', 'v-chest-supported-row']),
      ex('ua-4', 'v-shoulder-press-machine', 2, 8, 12, 90, ['v-db-seated-shoulder-press']),
      ex('ua-5', 'v-db-lateral-raise', 2, 12, 20, 60, ['v-cable-lateral-raise']),
      ex('ua-6', 'v-triceps-pushdown', 2, 10, 15, 75, ['v-triceps-extension-machine']),
    ],
  },
  {
    id: 'day-lower-a',
    name: 'Tren inferior A',
    weekday: 2,
    timeSplit: SPLIT,
    exercises: [
      ex('la-1', 'v-leg-press', 3, 10, 12, 120, ['v-goblet-squat', 'v-smith-squat']),
      ex('la-2', 'v-db-rdl', 3, 8, 10, 120, ['v-bb-rdl']),
      ex('la-3', 'v-seated-leg-curl', 2, 10, 15, 90, ['v-lying-leg-curl']),
      ex('la-4', 'v-leg-extension', 2, 10, 15, 75, ['v-goblet-squat'], {
        notes:
          'Si falta la extensión, la sentadilla goblet permite trabajar cuádriceps con otro patrón. No reproduce el aislamiento de la máquina; revisa la técnica y no copies la carga.',
      }),
      ex('la-5', 'v-db-calf-raise', 2, 12, 20, 60, ['v-standing-calf-machine', 'v-smith-calf-raise']),
      ex('la-6', 'v-pallof-press', 2, 10, 10, 60, ['v-pallof-hold'], { repsMode: 'per-side', durationMin: 20, durationMax: 30 }),
    ],
  },
  {
    id: 'day-upper-b',
    name: 'Tren superior B',
    weekday: 4,
    timeSplit: SPLIT,
    exercises: [
      ex('ub-1', 'v-incline-db-press', 3, 8, 12, 120, ['v-incline-press-machine', 'v-db-bench-press']),
      ex('ub-2', 'v-lat-pulldown-neutral', 3, 8, 12, 120, ['v-lat-pulldown-wide', 'v-lat-pulldown-supine']),
      ex('ub-3', 'v-seated-cable-row', 2, 10, 12, 90, ['v-seated-row-machine', 'v-chest-supported-row']),
      ex('ub-4', 'v-reverse-pec-deck', 2, 12, 20, 60, ['v-cable-reverse-fly']),
      ex('ub-5', 'v-db-lateral-raise', 2, 12, 20, 60, ['v-cable-lateral-raise']),
      ex('ub-6', 'v-db-curl', 2, 10, 15, 75, ['v-cable-curl']),
    ],
  },
  {
    id: 'day-lower-b',
    name: 'Tren inferior B',
    weekday: 6,
    timeSplit: SPLIT,
    exercises: [
      ex('lb-1', 'v-smith-squat', 3, 8, 12, 120, ['v-leg-press', 'v-goblet-squat']),
      ex('lb-2', 'v-smith-hip-thrust', 3, 8, 12, 120, ['v-hip-thrust-machine', 'v-db-rdl'], {
        notes:
          'Si no hay Smith ni máquina de hip thrust, el rumano con mancuernas ofrece otra bisagra de cadera. Cambia el recorrido y el reparto muscular; no es el mismo ejercicio ni una carga comparable.',
      }),
      ex('lb-3', 'v-seated-leg-curl', 2, 10, 15, 90, ['v-lying-leg-curl']),
      ex('lb-4', 'v-db-split-squat', 2, 8, 12, 90, ['v-smith-split-squat'], { repsMode: 'per-side' }),
      ex('lb-5', 'v-db-calf-raise', 2, 12, 20, 60, ['v-standing-calf-machine', 'v-smith-calf-raise']),
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
  version: 2,
  archived: false,
  createdAt: SEED_TIME,
  updatedAt: '2026-10-12T00:00:00.000Z',
};
