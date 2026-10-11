import type { Clip, Prim } from '../clip';
import { mix, repPhases, repProgress } from '../clip';
import { beam, dumbbellEnd, floor, lever, pad, rect, weightStack, L } from '../equipment/parts';
import { gripPoint, type Pose } from '../rig';
import { add, ankleOnBall, ankleOnFloor, arcAround, pointAt, v } from './helpers';
import { DOWN_FIRST, pelvisFor, seeThrough, smithFrame } from './legs';
import { FLOOR } from './postures';
import { barbellEnd } from '../equipment/parts';

/* ---------- Hip thrust ---------- */

const HT_CONTACT = v(-24, 58);
const htAnkle = ankleOnFloor(46, FLOOR);
const HT_PHASES = repPhases(['Abajo: cadera flexionada', 'Extensión de cadera', 'Pausa: tronco y muslos alineados', 'Descenso controlado']);

function hipThrustPose(p: number, fixedHipX?: number): Pose {
  const b: Pose = {
    pelvis: v(0, 0),
    abdomen: mix(-52, -88, p),
    spine: mix(4, 0, p),
    neck: mix(40, 22, p),
    limbs: {
      legNear: { ik: htAnkle, bend: -1 },
      legFar: { ik: add(htAnkle, v(-2, 0)), bend: -1 },
    },
  };
  let pelvis = pelvisFor(b, 'chest', 0.72, -12.6, HT_CONTACT);
  if (fixedHipX !== undefined) pelvis = v(fixedHipX, pelvis.y);
  const pose = { ...b, pelvis };
  const g = pointAt(pose, 'abdomen', 0.35, 16);
  return { ...pose, limbs: { ...pose.limbs, armNear: { ik: g, bend: -1 }, armFar: { ik: add(g, v(-1, -1)), bend: -1 } } };
}

const htBench: Prim[] = [
  pad('bench', L.mid, v(-60, HT_CONTACT.y + 4), v(HT_CONTACT.x + 2, HT_CONTACT.y + 4), 8),
  beam('bpost', L.mid - 0.1, v(-40, HT_CONTACT.y + 8), v(-40, FLOOR), 5),
];

const htHipPivot = v(70, 92);
const htPadStart = pointAt(hipThrustPose(0), 'abdomen', 0.05, 15);
const htPadPath = arcAround(htHipPivot, htPadStart, 24);

export const hipThrustMachine: Clip = {
  id: 'v-hip-thrust-machine',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-80, -20, 175, 130],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: HT_PHASES,
  caption: 'Máquina genérica: espalda alta apoyada y almohadilla sobre la cadera. El mentón se mantiene recogido.',
  pose: (t) => hipThrustPose(repProgress(t)),
  equipment(_rig, t) {
    const p = repProgress(t);
    const padC = pointAt(hipThrustPose(p), 'abdomen', 0.05, 16);
    return [
      floor(FLOOR),
      ...htBench,
      beam('base', L.back, v(-70, FLOOR - 2), v(95, FLOOR - 2), 4),
      beam('column', L.back, v(88, FLOOR), v(88, 10), 6),
      ...weightStack('stack', L.back + 0.1, v(102, FLOOR - 3), htPadPath.travel(p) * 0.5, 90),
      ...lever('lever', L.nearArm + 0.6, htHipPivot, padC, 4),
      pad('hippad', L.nearArm + 0.7, add(padC, v(-6, 0)), add(padC, v(6, 0)), 6),
    ];
  },
};

export const smithHipThrust: Clip = {
  id: 'v-smith-hip-thrust',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-80, -45, 175, 155],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: HT_PHASES,
  caption: 'La barra guiada se mueve en vertical, por lo que la espalda alta rueda levemente sobre el banco. Disco translúcido.',
  pose: (t) => hipThrustPose(repProgress(t), 14),
  equipment(_rig, t) {
    const bar = pointAt(hipThrustPose(repProgress(t), 14), 'abdomen', 0.05, 17);
    return [floor(FLOOR), ...htBench, ...smithFrame(bar.x, bar.y, -30), rect('padbar', L.front - 0.1, bar, 10, 6, 0, 'eq-pad', 3)];
  },
};

/* ---------- Zancada estática / sentadilla dividida ---------- */

const FRONT_ANKLE = ankleOnFloor(14, FLOOR);
const BACK_BALL = v(-46, FLOOR);
const SPLIT_PHASES = repPhases(['Arriba: postura dividida', 'Descenso vertical', 'Abajo: rodilla trasera cerca del suelo', 'Subida con la pierna delantera'], DOWN_FIRST);

function splitPose(d: number): Pose {
  const backDeg = mix(52, 62, d);
  const backAnkle = ankleOnBall(BACK_BALL, backDeg);
  return {
    pelvis: v(-12, 20 + 29 * d),
    abdomen: 3,
    spine: 0,
    neck: 0,
    limbs: {
      legNear: { ik: FRONT_ANKLE, bend: -1 },
      legFar: { ik: backAnkle, bend: -1, end: backDeg },
    },
  };
}

export const dbSplitSquat: Clip = {
  id: 'v-db-split-squat',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-85, -70, 165, 180],
  floorY: FLOOR,
  seconds: 3.6,
  kind: 'reps',
  phases: SPLIT_PHASES,
  sideLabel: 'Trabaja la pierna delantera (cercana); repite cambiando de lado.',
  activeSides: ['near'],
  caption: 'Tronco erguido; el cuerpo baja en vertical entre ambos pies.',
  pose(t) {
    const b = splitPose(repProgress(t, DOWN_FIRST));
    return { ...b, limbs: { ...b.limbs, armNear: { fk: [90, 90] }, armFar: { fk: [91, 91] } } };
  },
  equipment(rig) {
    return [
      floor(FLOOR),
      ...dumbbellEnd('dbFar', L.farArm - 0.5, gripPoint(rig, 'far'), 7.5),
      ...dumbbellEnd('db', L.nearArm - 0.5, gripPoint(rig, 'near'), 7.5),
    ];
  },
};

export const smithSplitSquat: Clip = {
  id: 'v-smith-split-squat',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-85, -120, 165, 230],
  floorY: FLOOR,
  seconds: 3.6,
  kind: 'reps',
  phases: SPLIT_PHASES,
  sideLabel: 'Trabaja la pierna delantera (cercana); repite cambiando de lado.',
  activeSides: ['near'],
  caption: 'Barra guiada sobre la parte alta de la espalda; el cuerpo baja en vertical. Disco translúcido.',
  pose(t) {
    const b = splitPose(repProgress(t, DOWN_FIRST));
    const bar = pointAt(b, 'chest', 0.93, -12.5);
    return { ...b, limbs: { ...b.limbs, armNear: { ik: add(bar, v(3, 0)), bend: -1 }, armFar: { ik: add(bar, v(2, -1)), bend: -1 } } };
  },
  equipment(_rig, t) {
    const bar = pointAt(splitPose(repProgress(t, DOWN_FIRST)), 'chest', 0.93, -12.5);
    return [floor(FLOOR), ...smithFrame(bar.x, bar.y, -115)];
  },
};

export { seeThrough, barbellEnd };
