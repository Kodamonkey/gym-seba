import type { Clip } from '../clip';
import { mix, repPhases, repProgress } from '../clip';
import { beam, disc, dumbbellEnd, dumbbellProfile, floor, lever, pad, rect, weightStack, L } from '../equipment/parts';
import { gripPoint, type Pose } from '../rig';
import { add, ankleOnFloor, arc, lerpV, pointAt, shoulderAt, v } from './helpers';
import { FLOOR, seatedCoronal } from './postures';

/* ---------- Press con mancuernas en banco plano (acostado, vista lateral) ---------- */

const BENCH_TOP = 60;
const flatBase: Pose = {
  pelvis: v(20, BENCH_TOP - 10.6),
  abdomen: -90,
  spine: -4,
  neck: 6,
  limbs: {},
};
const flatShoulder = shoulderAt(flatBase);
const flatAnkle = ankleOnFloor(64, FLOOR);
const FLAT_BOTTOM = add(flatShoulder, v(11, -12));
const FLAT_TOP = add(flatShoulder, v(4, -61));

export const dbBenchPress: Clip = {
  id: 'v-db-bench-press',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-80, -45, 175, 160],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: repPhases(['Inicio: mancuernas junto al pecho', 'Empuje hacia arriba', 'Brazos casi extendidos', 'Descenso controlado']),
  caption: 'Brazo cercano translúcido para ver el pectoral; el húmero se acorta por el escorzo (codos abiertos ~45–60°).',
  ghost: ['arm'],
  pose(t) {
    const p = repProgress(t);
    const grip = lerpV(FLAT_BOTTOM, FLAT_TOP, p);
    const arm = { ik: grip, bend: 1 as const, scale: mix(0.58, 0.98, p), scale2: 0.95 };
    return {
      ...flatBase,
      limbs: {
        armNear: arm,
        armFar: { ...arm, ik: add(grip, v(-1, -1)) },
        legNear: { ik: flatAnkle, bend: -1 },
        legFar: { ik: add(flatAnkle, v(-3, 0)), bend: -1 },
      },
    };
  },
  equipment(rig) {
    const g = gripPoint(rig, 'near');
    return [
      floor(FLOOR),
      pad('bench', L.mid, v(-42, BENCH_TOP + 4), v(36, BENCH_TOP + 4), 8),
      beam('leg1', L.mid - 0.1, v(-32, BENCH_TOP + 8), v(-32, FLOOR), 5),
      beam('leg2', L.mid - 0.1, v(26, BENCH_TOP + 8), v(26, FLOOR), 5),
      beam('rail', L.mid - 0.1, v(-40, FLOOR - 2), v(34, FLOOR - 2), 4),
      ...dumbbellEnd('dbFar', L.farArm - 0.5, add(g, v(-1, -1)), 8),
      ...dumbbellEnd('db', L.nearArm - 0.5, g, 8),
    ];
  },
};

/* ---------- Press inclinado con mancuernas (~30°) ---------- */

const INC_SEAT = 62;
const incBase: Pose = {
  pelvis: v(14, INC_SEAT - 10.4),
  abdomen: -60,
  spine: -2,
  neck: 18,
  limbs: {},
};
const incShoulder = shoulderAt(incBase);
const incAnkle = ankleOnFloor(52, FLOOR);
const INC_BOTTOM = add(incShoulder, v(13, -8));
const INC_TOP = add(incShoulder, v(3, -60));
const incBack0 = pointAt(incBase, 'abdomen', 0.15, -12.5);
const incBack1 = pointAt(incBase, 'chest', 1.05, -12.5);

export const inclineDbPress: Clip = {
  id: 'v-incline-db-press',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-80, -70, 175, 180],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: repPhases(['Inicio: mancuernas en la parte alta del pecho', 'Empuje', 'Brazos casi extendidos', 'Descenso controlado']),
  caption: 'Banco a unos 30°. Brazo cercano translúcido; húmero acortado por el escorzo.',
  ghost: ['arm'],
  pose(t) {
    const p = repProgress(t);
    const grip = lerpV(INC_BOTTOM, INC_TOP, p);
    const arm = { ik: grip, bend: 1 as const, scale: mix(0.6, 0.98, p), scale2: 0.95 };
    return {
      ...incBase,
      limbs: {
        armNear: arm,
        armFar: { ...arm, ik: add(grip, v(-1, -1)) },
        legNear: { ik: incAnkle, bend: -1 },
        legFar: { ik: add(incAnkle, v(-3, 0)), bend: -1 },
      },
    };
  },
  equipment(rig) {
    const g = gripPoint(rig, 'near');
    return [
      floor(FLOOR),
      pad('seat', L.mid, v(-2, INC_SEAT + 4), v(34, INC_SEAT + 4), 8),
      pad('back', L.mid + 0.1, add(incBack0, v(2, 3)), add(incBack1, v(0, 0)), 8),
      beam('post', L.mid - 0.1, v(12, INC_SEAT + 8), v(12, FLOOR), 5),
      beam('brace', L.mid - 0.1, add(incBack0, v(-8, 8)), v(-30, FLOOR), 4),
      beam('rail', L.mid - 0.1, v(-36, FLOOR - 2), v(36, FLOOR - 2), 4),
      ...dumbbellEnd('dbFar', L.farArm - 0.5, add(g, v(-1, -1)), 8),
      ...dumbbellEnd('db', L.nearArm - 0.5, g, 8),
    ];
  },
};

/* ---------- Press inclinado en máquina ---------- */

const imBase: Pose = { pelvis: v(0, 52), abdomen: -26, spine: 2, neck: 12, limbs: {} };
const imShoulder = shoulderAt(imBase);
const IM_START = add(imShoulder, v(18, -4));
const IM_END = add(imShoulder, v(44, -40));
const imPath = arc(IM_START, IM_END, 90, -1);
const imAnkle = ankleOnFloor(36, FLOOR);
const imBack0 = pointAt(imBase, 'abdomen', 0.1, -12.6);
const imBack1 = pointAt(imBase, 'chest', 1.05, -12.6);

export const inclinePressMachine: Clip = {
  id: 'v-incline-press-machine',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-85, -80, 180, 190],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: repPhases(['Inicio: agarres a la altura alta del pecho', 'Empuje en diagonal', 'Brazos casi extendidos', 'Retorno controlado']),
  caption: 'Máquina genérica; el ángulo del respaldo y la trayectoria varían según el modelo. Brazo cercano translúcido.',
  ghost: ['arm'],
  pose(t) {
    const p = repProgress(t);
    const grip = imPath.at(p);
    const arm = { ik: grip, bend: 1 as const, scale: mix(0.58, 0.97, p), scale2: 0.95 };
    return {
      ...imBase,
      limbs: {
        armNear: arm,
        armFar: { ...arm, ik: add(grip, v(-1.5, -1)) },
        legNear: { ik: imAnkle, bend: -1 },
        legFar: { ik: add(imAnkle, v(-2, 0)), bend: -1 },
      },
    };
  },
  equipment(rig, t) {
    const p = repProgress(t);
    const g = gripPoint(rig, 'near');
    return [
      floor(FLOOR),
      beam('base', L.back, v(-75, FLOOR - 2), v(40, FLOOR - 2), 4),
      beam('upright', L.back, v(-45, FLOOR), v(-45, imPath.pivot.y), 6),
      beam('top', L.back, v(-45, imPath.pivot.y + 2), add(imPath.pivot, v(3, 2)), 5),
      ...weightStack('stack', L.back + 0.1, v(-66, FLOOR - 3), imPath.travel(p) * 0.4, 135),
      beam('seatpost', L.mid, v(2, 70), v(2, FLOOR), 5),
      beam('backpost', L.mid, add(imBack0, v(-6, 4)), v(-16, FLOOR - 2), 4),
      pad('seat', L.mid + 0.1, v(-17, 66), v(24, 66), 8),
      pad('backrest', L.mid + 0.1, add(imBack0, v(-4, 0)), add(imBack1, v(-4, 0)), 8),
      ...lever('lever', L.torso - 1, imPath.pivot, g, 4.5),
      rect('handle', L.nearArm - 0.5, g, 4, 4, 0, 'eq-metal', 2),
      disc('handleEnd', L.nearArm + 1, g, 1.6, 'eq-metal'),
    ];
  },
};

/* ---------- Press de hombros (vista frontal) ---------- */

const SP_HIP_Y = 55;
const spBase = seatedCoronal(SP_HIP_Y, { spread: 12, thighScale: 0.18 });
const spShoulderL = shoulderAt(spBase, 'front', 'L');

function shoulderPressPose(p: number, startDy: number, endDy: number, startDx: number, endDx: number): Pose {
  const gL = add(spShoulderL, v(mix(startDx, endDx, p), mix(startDy, endDy, p)));
  const gR = v(-gL.x, gL.y);
  return {
    ...spBase,
    limbs: {
      ...spBase.limbs,
      armL: { ik: gL, bend: 1, scale: 0.92, scale2: 0.95 },
      armR: { ik: gR, bend: -1, scale: 0.92, scale2: 0.95 },
    },
  };
}

export const dbSeatedShoulderPress: Clip = {
  id: 'v-db-seated-shoulder-press',
  view: 'front',
  viewLabel: 'Vista frontal',
  viewBox: [-100, -75, 200, 185],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: repPhases(['Inicio: mancuernas a la altura de los hombros', 'Empuje hacia arriba', 'Brazos casi extendidos', 'Descenso controlado']),
  caption: 'Sentado con respaldo casi vertical (detrás de la persona). Muslos en escorzo hacia el observador.',
  pose: (t) => shoulderPressPose(repProgress(t), -22, -57, 26, 8),
  equipment(rig) {
    const gL = gripPoint(rig, 'L');
    const gR = gripPoint(rig, 'R');
    return [
      floor(FLOOR),
      rect('backrest', L.back, v(0, SP_HIP_Y - 38), 34, 80, 0, 'eq-pad', 5),
      rect('seat', L.mid, v(0, SP_HIP_Y + 12), 40, 7, 0, 'eq-pad', 3),
      beam('post', L.back, v(0, SP_HIP_Y + 15), v(0, FLOOR), 6),
      beam('foot', L.back, v(-25, FLOOR - 2), v(25, FLOOR - 2), 4),
      ...dumbbellProfile('dbL', L.nearArm + 1, gL, 0, 13, 5.5, 15),
      ...dumbbellProfile('dbR', L.nearArm + 1, gR, 0, 13, 5.5, 15),
    ];
  },
};

export const shoulderPressMachine: Clip = {
  id: 'v-shoulder-press-machine',
  view: 'front',
  viewLabel: 'Vista frontal',
  viewBox: [-100, -95, 200, 205],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: repPhases(['Inicio: agarres a la altura de los hombros', 'Empuje hacia arriba', 'Brazos casi extendidos', 'Descenso controlado']),
  caption: 'Máquina genérica con agarres a los lados; el respaldo y la torre quedan detrás de la persona.',
  pose: (t) => shoulderPressPose(repProgress(t), -18, -52, 25, 12),
  equipment(rig, t) {
    const p = repProgress(t);
    const gL = gripPoint(rig, 'L');
    const gR = gripPoint(rig, 'R');
    return [
      floor(FLOOR),
      beam('postL', L.back - 0.2, v(30, FLOOR), v(30, -70), 6),
      beam('postR', L.back - 0.2, v(-30, FLOOR), v(-30, -70), 6),
      beam('cross', L.back - 0.2, v(-33, -70), v(33, -70), 6),
      ...weightStack('stack', L.back - 0.1, v(55, FLOOR - 3), p * 24, 150).map((x) => ({ ...x, layer: x.layer - 1 })),
      rect('backrest', L.back, v(0, SP_HIP_Y - 38), 34, 80, 0, 'eq-pad', 5),
      rect('seat', L.mid, v(0, SP_HIP_Y + 12), 40, 7, 0, 'eq-pad', 3),
      beam('foot', L.back, v(-35, FLOOR - 2), v(35, FLOOR - 2), 4),
      beam('armL', L.back + 0.5, v(36, SP_HIP_Y - 25), add(gL, v(4, 0)), 4.5),
      beam('armR', L.back + 0.5, v(-36, SP_HIP_Y - 25), add(gR, v(-4, 0)), 4.5),
      beam('hL', L.nearArm + 1, add(gL, v(-6, 0)), add(gL, v(6, 0)), 3.4, 'eq-metal', 1.5),
      beam('hR', L.nearArm + 1, add(gR, v(-6, 0)), add(gR, v(6, 0)), 3.4, 'eq-metal', 1.5),
    ];
  },
};
