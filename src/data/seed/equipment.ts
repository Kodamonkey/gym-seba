import type { EquipmentInstance, EquipmentKind } from '../../domain/types';

/**
 * Inventario inicial. Ningún equipo está confirmado en la sede: todos parten
 * "por verificar" y sin incremento mínimo ni resistencia base conocidos.
 */

const SEED_TIME = '2026-10-11T00:00:00.000Z';

function eq(id: string, name: string, kind: EquipmentKind, variantIds: string[]): EquipmentInstance {
  return {
    id,
    name,
    kind,
    variantIds,
    status: 'unverified',
    unit: 'kg',
    minIncrement: null,
    declaredBaseResistance: null,
    location: '',
    archived: false,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  };
}

export const EQUIPMENT: EquipmentInstance[] = [
  eq('eq-chest-press', 'Máquina de press de pecho', 'machine', ['v-chest-press-machine']),
  eq('eq-incline-press', 'Máquina de press inclinado', 'machine', ['v-incline-press-machine']),
  eq('eq-lat-pulldown', 'Estación de jalón al pecho', 'cable', ['v-lat-pulldown-wide', 'v-lat-pulldown-supine', 'v-lat-pulldown-neutral']),
  eq('eq-seated-row', 'Máquina de remo sentado', 'machine', ['v-seated-row-machine']),
  eq('eq-low-row', 'Polea baja de remo', 'cable', ['v-seated-cable-row']),
  eq('eq-chest-supported-row', 'Máquina de remo con apoyo de pecho', 'machine', ['v-chest-supported-row']),
  eq('eq-shoulder-press', 'Máquina de press de hombros', 'machine', ['v-shoulder-press-machine']),
  eq('eq-reverse-pec-deck', 'Máquina de aperturas (pec deck)', 'machine', ['v-reverse-pec-deck']),
  eq('eq-cable-column', 'Columna de polea ajustable', 'cable', [
    'v-cable-lateral-raise',
    'v-triceps-pushdown',
    'v-cable-curl',
    'v-pallof-press',
    'v-pallof-hold',
    'v-cable-crunch',
  ]),
  eq('eq-cable-crossover', 'Cruce de poleas', 'cable', ['v-cable-reverse-fly']),
  eq('eq-triceps-machine', 'Máquina de extensión de tríceps', 'machine', ['v-triceps-extension-machine']),
  eq('eq-leg-press', 'Prensa de piernas 45°', 'machine', ['v-leg-press']),
  eq('eq-lying-leg-curl', 'Máquina de curl femoral acostado', 'machine', ['v-lying-leg-curl']),
  eq('eq-seated-leg-curl', 'Máquina de curl femoral sentado', 'machine', ['v-seated-leg-curl']),
  eq('eq-leg-extension', 'Máquina de extensión de cuádriceps', 'machine', ['v-leg-extension']),
  eq('eq-calf-machine', 'Máquina de pantorrillas de pie', 'machine', ['v-standing-calf-machine']),
  eq('eq-hip-thrust', 'Máquina de hip thrust', 'machine', ['v-hip-thrust-machine']),
  eq('eq-smith', 'Máquina Smith', 'smith', ['v-smith-squat', 'v-smith-calf-raise', 'v-smith-hip-thrust', 'v-smith-split-squat']),
  eq('eq-ab-machine', 'Máquina abdominal', 'machine', ['v-ab-crunch-machine']),
  eq('eq-dumbbells', 'Mancuernas', 'dumbbell', [
    'v-db-bench-press',
    'v-incline-db-press',
    'v-db-seated-shoulder-press',
    'v-db-lateral-raise',
    'v-db-curl',
    'v-goblet-squat',
    'v-db-rdl',
    'v-db-calf-raise',
    'v-db-split-squat',
  ]),
  eq('eq-barbell', 'Barra olímpica y discos', 'barbell', ['v-bb-rdl']),
  eq('eq-adjustable-bench', 'Banco ajustable', 'bodyweight', ['v-db-bench-press', 'v-incline-db-press', 'v-db-seated-shoulder-press', 'v-smith-hip-thrust']),
];
