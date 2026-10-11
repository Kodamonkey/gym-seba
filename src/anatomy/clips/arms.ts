import type { Clip } from '../clip';
import { mix, repPhases, repProgress } from '../clip';
import { bar } from '../geom';
import { beam, cable, disc, dumbbellEnd, floor, lever, pad, pulley, rect, weightStack, L } from '../equipment/parts';
import { gripPoint, jointPoint, type Pose } from '../rig';
import { add, v } from './helpers';
import { FLOOR, seatedSide, standingSide } from './postures';

/* ---------- Extensión de tríceps en polea alta con cuerda ---------- */

const pdBase = standingSide({ heelX: -6, abdomen: 12, neck: -6 });
const PD_PULLEY = v(34, -62);

function pushdownPose(p: number): Pose {
  const arm = { fk: [86, mix(-12, 86, p)] as [number, number] };
  return { ...pdBase, limbs: { ...pdBase.limbs, armNear: arm, armFar: { fk: [87, mix(-11, 87, p)] } } };
}

export const tricepsPushdown: Clip = {
  id: 'v-triceps-pushdown',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-70, -80, 165, 190],
  floorY: FLOOR,
  seconds: 3,
  kind: 'reps',
  phases: repPhases(['Inicio: antebrazos casi horizontales', 'Extensión de codos', 'Brazos extendidos', 'Retorno controlado']),
  caption: 'Codos fijos junto al cuerpo; la cuerda se separa ligeramente abajo.',
  pose: (t) => pushdownPose(repProgress(t)),
  equipment(rig, t) {
    const g = gripPoint(rig, 'near');
    return [
      floor(FLOOR),
      beam('column', L.back, v(48, FLOOR), v(48, -75), 7),
      ...weightStack('stack', L.back + 0.1, v(66, FLOOR - 3), repProgress(t) * 30, 160),
      ...pulley('pulley', L.back + 0.2, PD_PULLEY, 3.5),
      beam('arm', L.back + 0.15, v(48, -66), add(PD_PULLEY, v(2, 0)), 3),
      cable('cable', L.nearArm - 0.6, [PD_PULLEY, g]),
      { key: 'rope', layer: L.nearArm + 1, d: bar(add(g, v(0, -3)), add(g, v(0.8, 6)), 2.4, 1.2), cls: 'eq-metal' },
    ];
  },
};

/* ---------- Máquina de extensión de tríceps (sentado) ---------- */

const teBase = seatedSide({ hip: v(0, 52), abdomen: 4, neck: 0, heelX: 30 });
const UPPER_DEG = 32;

function tricepsMachinePose(p: number): Pose {
  const flex = mix(118, 12, p);
  const arm = { fk: [UPPER_DEG, UPPER_DEG - flex] as [number, number] };
  return { ...teBase, limbs: { ...teBase.limbs, armNear: arm, armFar: arm } };
}

export const tricepsExtensionMachine: Clip = {
  id: 'v-triceps-extension-machine',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-60, -45, 160, 150],
  floorY: FLOOR,
  seconds: 3,
  kind: 'reps',
  phases: repPhases(['Inicio: codos flexionados', 'Extensión de codos', 'Brazos casi extendidos', 'Retorno controlado']),
  caption: 'El codo se alinea con el eje de giro de la máquina; los brazos descansan en la almohadilla.',
  pose: (t) => tricepsMachinePose(repProgress(t)),
  equipment(rig, t) {
    const p = repProgress(t);
    const elbow = jointPoint(rig, 'forearm.near');
    const sh = jointPoint(rig, 'upperArm.near');
    const g = gripPoint(rig, 'near');
    return [
      floor(FLOOR),
      beam('base', L.back, v(-30, FLOOR - 2), v(90, FLOOR - 2), 4),
      beam('column', L.back, v(75, FLOOR), v(75, -40), 6),
      ...weightStack('stack', L.back + 0.1, v(92, FLOOR - 3), p * 28, 135),
      beam('seatpost', L.mid, v(2, 70), v(2, FLOOR), 5),
      pad('seat', L.mid + 0.1, v(-16, 66), v(22, 66), 8),
      pad('armpad', L.nearArm - 1, add(sh, v(4, 9)), add(elbow, v(-2, 7)), 6),
      beam('padpost', L.mid, add(elbow, v(-4, 10)), v(40, FLOOR), 4),
      ...lever('lever', L.nearArm + 0.5, elbow, add(g, v(1, 0)), 3.5),
      rect('handle', L.nearArm + 0.6, g, 4, 4, 0, 'eq-metal', 2),
    ];
  },
};

/* ---------- Curl de bíceps en polea baja ---------- */

const cuBase = standingSide({ heelX: -4, abdomen: 2, neck: 0 });
const CU_PULLEY = v(36, FLOOR - 9);

function curlPose(p: number): Pose {
  const near = { fk: [88, mix(84, -58, p)] as [number, number] };
  const far = { fk: [89, mix(85, -57, p)] as [number, number] };
  return { ...cuBase, limbs: { ...cuBase.limbs, armNear: near, armFar: far } };
}

export const cableCurl: Clip = {
  id: 'v-cable-curl',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-70, -80, 165, 190],
  floorY: FLOOR,
  seconds: 3,
  kind: 'reps',
  phases: repPhases(['Inicio: brazos extendidos', 'Flexión de codos', 'Contracción', 'Descenso controlado']),
  caption: 'Codos junto al cuerpo durante todo el recorrido.',
  pose: (t) => curlPose(repProgress(t)),
  equipment(rig, t) {
    const g = gripPoint(rig, 'near');
    return [
      floor(FLOOR),
      beam('column', L.back, v(48, FLOOR), v(48, -75), 7),
      ...weightStack('stack', L.back + 0.1, v(66, FLOOR - 3), repProgress(t) * 32, 160),
      ...pulley('pulley', L.back + 0.2, CU_PULLEY, 3.5),
      cable('cable', L.nearArm - 0.6, [CU_PULLEY, g]),
      rect('bar', L.nearArm - 0.5, g, 4.5, 4.5, 0, 'eq-metal', 2),
      disc('barEnd', L.nearArm + 1, g, 1.6, 'eq-metal'),
    ];
  },
};

/* ---------- Curl con mancuernas ---------- */

export const dbCurl: Clip = {
  id: 'v-db-curl',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-70, -80, 150, 190],
  floorY: FLOOR,
  seconds: 3,
  kind: 'reps',
  phases: repPhases(['Inicio: brazos extendidos', 'Flexión de codos', 'Contracción', 'Descenso controlado']),
  caption: 'Ambos brazos a la vez; palmas hacia delante y codos junto al cuerpo.',
  pose: (t) => curlPose(repProgress(t)),
  equipment(rig) {
    const g = gripPoint(rig, 'near');
    const gf = gripPoint(rig, 'far');
    return [floor(FLOOR), ...dumbbellEnd('dbFar', L.farArm - 0.5, gf, 7.5), ...dumbbellEnd('db', L.nearArm - 0.5, g, 7.5)];
  },
};

