import type { Clip } from '../clip';
import { repPhases, repProgress } from '../clip';
import { beam, disc, floor, lever, pad, rect, weightStack, L } from '../equipment/parts';
import type { Pose } from '../rig';
import { add, ankleOnFloor, arc, pointAt, shoulderAt, v } from './helpers';

const FLOOR = 105;
const HIP = v(0, 52);

const base: Pose = {
  pelvis: HIP,
  abdomen: -10,
  spine: 3,
  neck: 4,
  limbs: {},
};

const shoulder = shoulderAt(base);
const START = add(shoulder, v(22, 12));
const END = add(shoulder, v(60, 8));
const path = arc(START, END, 80, -1);
const ankle = ankleOnFloor(38, FLOOR);
const back0 = pointAt(base, 'abdomen', 0.1, -12.6);
const back1 = pointAt(base, 'chest', 0.98, -12.6);

export const chestPressMachine: Clip = {
  id: 'v-chest-press-machine',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-80, -55, 175, 165],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: repPhases(['Inicio: agarres junto al pecho', 'Empuje', 'Brazos casi extendidos', 'Retorno controlado']),
  caption:
    'Máquina genérica de pila; la posición de agarres y asiento varía según el modelo. El brazo cercano se muestra translúcido y acortado por el escorzo (los codos se abren hacia los lados).',
  ghost: ['arm'],
  pose(t) {
    const p = repProgress(t);
    const grip = path.at(p);
    return {
      ...base,
      limbs: {
        armNear: { ik: grip, bend: 1, scale: 0.55 + 0.42 * p, scale2: 0.95 },
        armFar: { ik: add(grip, v(-1.5, -1)), bend: 1, scale: 0.55 + 0.42 * p, scale2: 0.95 },
        legNear: { ik: ankle, bend: -1 },
        legFar: { ik: add(ankle, v(-2, 0)), bend: -1 },
      },
    };
  },
  equipment(_rig, t) {
    const p = repProgress(t);
    const grip = path.at(p);
    return [
      floor(FLOOR),
      beam('base', L.back, v(-70, FLOOR - 2), v(40, FLOOR - 2), 4),
      beam('upright', L.back, v(-40, FLOOR), v(-40, path.pivot.y - 6), 6),
      beam('topbar', L.back, v(-40, path.pivot.y - 3), add(path.pivot, v(4, -3)), 5),
      ...weightStack('stack', L.back + 0.1, v(-62, FLOOR - 3), path.travel(p) * 0.45, 135),
      beam('seatpost', L.mid, v(2, 70), v(2, FLOOR), 5),
      beam('backpost', L.mid, add(back0, v(-6, 4)), v(-14, FLOOR - 2), 4),
      pad('seat', L.mid + 0.1, v(-17, 66), v(24, 66), 8),
      pad('backrest', L.mid + 0.1, add(back0, v(-4, 0)), add(back1, v(-4, 0)), 8),
      ...lever('lever', L.torso - 1, path.pivot, grip, 4.5),
      rect('handle', L.nearArm - 0.5, grip, 4, 4, 0, 'eq-metal', 2),
      disc('handleEnd', L.nearArm + 1, add(grip, v(0, 0)), 1.6, 'eq-metal'),
    ];
  },
};
