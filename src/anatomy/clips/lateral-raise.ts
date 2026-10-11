import type { Clip } from '../clip';
import { repPhases, repProgress, mix } from '../clip';
import { beam, cable, dumbbellEnd, floor, pulley, weightStack, L } from '../equipment/parts';
import { gripPoint, type Pose } from '../rig';
import { add, v } from './helpers';

const FLOOR = 105;
const STAND_HIP_Y = FLOOR - 8 - 43 - 44 + 0.5;

function standingFront(): Pose {
  return {
    pelvis: v(0, STAND_HIP_Y),
    abdomen: 0,
    spine: 0,
    neck: 0,
    limbs: {
      legL: { fk: [88, 90] },
      legR: { fk: [92, 90] },
    },
  };
}

/** Elevación lateral con mancuernas, ambos brazos (vista frontal). */
export const dbLateralRaise: Clip = {
  id: 'v-db-lateral-raise',
  view: 'front',
  viewLabel: 'Vista frontal',
  viewBox: [-110, -80, 220, 192],
  floorY: FLOOR,
  seconds: 3.2,
  kind: 'reps',
  phases: repPhases(['Inicio: brazos a los lados', 'Elevación lateral', 'A la altura de los hombros', 'Descenso controlado']),
  caption: 'Codos levemente flexionados; los antebrazos apuntan un poco hacia delante (escorzo).',
  pose(t) {
    const p = repProgress(t);
    const abd = mix(12, 86, p);
    const base = standingFront();
    return {
      ...base,
      limbs: {
        ...base.limbs,
        armL: { fk: [90 - abd, 90 - abd - 6], scale2: 0.92 },
        armR: { fk: [90 + abd, 90 + abd + 6], scale2: 0.92 },
      },
    };
  },
  equipment(rig) {
    return [floor(FLOOR), ...dumbbellEnd('dbL', L.nearArm + 1, gripPoint(rig, 'L'), 6.5), ...dumbbellEnd('dbR', L.nearArm + 1, gripPoint(rig, 'R'), 6.5)];
  },
};

/** Elevación lateral en polea baja, brazo izquierdo de la persona (vista frontal). */
export const cableLateralRaise: Clip = {
  id: 'v-cable-lateral-raise',
  view: 'front',
  viewLabel: 'Vista frontal',
  viewBox: [-120, -80, 230, 192],
  floorY: FLOOR,
  seconds: 3.2,
  kind: 'reps',
  sideLabel: 'Se muestra el brazo izquierdo; repite con el otro lado.',
  phases: repPhases(['Inicio: agarre frente a la cadera', 'Elevación lateral', 'A la altura del hombro', 'Descenso controlado']),
  caption: 'La polea baja está al lado contrario del brazo que trabaja; el cable cruza por delante del cuerpo.',
  activeSides: ['L'],
  pose(t) {
    const p = repProgress(t);
    const abd = mix(-8, 84, p);
    const base = standingFront();
    return {
      ...base,
      abdomen: -2,
      limbs: {
        ...base.limbs,
        armL: { fk: [90 - abd, 90 - abd - 8], scale2: 0.92 },
        // Mano libre apoyada en la columna.
        armR: { ik: v(-64, -8), bend: -1 },
      },
    };
  },
  equipment(rig, t) {
    const p = repProgress(t);
    const pul = v(-62, FLOOR - 10);
    const grip = gripPoint(rig, 'L');
    return [
      floor(FLOOR),
      beam('column', L.back, v(-72, FLOOR), v(-72, FLOOR - 160), 7),
      ...weightStack('stack', L.back + 0.1, v(-90, FLOOR - 3), p * 30, 150),
      beam('rail', L.back + 0.2, v(-66, FLOOR - 4), v(-66, FLOOR - 150), 3),
      ...pulley('pulley', L.back + 0.3, pul, 3.5),
      cable('cable', L.nearArm + 0.5, [pul, grip]),
      { key: 'handle', layer: L.nearArm + 1, d: `M${grip.x - 2},${grip.y}a2,2 0 1,0 4,0a2,2 0 1,0 -4,0Z`, cls: 'eq-metal' },
      beam('hold', L.back + 0.3, add(v(-66, 0), v(0, 0)), v(-66, 2), 1),
    ];
  },
};
