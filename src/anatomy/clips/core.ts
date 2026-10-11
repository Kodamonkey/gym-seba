import type { Clip } from '../clip';
import { mix, repPhases, repProgress } from '../clip';
import { beam, cable, disc, floor, lever, pad, pulley, rect, weightStack, L } from '../equipment/parts';
import { gripPoint, type Pose } from '../rig';
import { add, lerpV, pointAt, shoulderAt, v } from './helpers';
import { FLOOR, seatedSide, standingSide } from './postures';

/* ---------- Pallof press ---------- */

const pfBase = standingSide({ heelX: -4, abdomen: 0, neck: 0 });
const PF_START = pointAt(pfBase, 'chest', 0.66, 17);
const PF_END = add(shoulderAt(pfBase), v(57, 10));
const PF_PULLEY = add(PF_START, v(-4, 0));

function pallofPose(p: number): Pose {
  const g = lerpV(PF_START, PF_END, p);
  const arm = { ik: g, bend: 1 as const, scale: 0.96, scale2: 0.96 };
  return { ...pfBase, limbs: { ...pfBase.limbs, armNear: arm, armFar: { ...arm, ik: add(g, v(-1, -1)) } } };
}

function pallofEquipment(g: { x: number; y: number }) {
  return [
    floor(FLOOR),
    { key: 'column', layer: L.back, d: rectPath(PF_PULLEY.x - 5, -70, 10, FLOOR + 70), cls: 'eq-ghost' },
    ...pulley('pulley', L.back + 0.1, PF_PULLEY, 3),
    cable('cable', L.nearArm - 0.6, [PF_PULLEY, g]),
    rect('handle', L.nearArm - 0.5, g, 4, 4, 0, 'eq-metal', 2),
    disc('handleEnd', L.nearArm + 1, g, 1.6, 'eq-metal'),
  ];
}

function rectPath(x: number, y: number, w: number, h: number): string {
  return `M${x},${y}h${w}v${h}h${-w}Z`;
}

export const pallofPress: Clip = {
  id: 'v-pallof-press',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-70, -80, 165, 190],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: repPhases(['Inicio: agarre en el centro del pecho', 'Empuje al frente', 'Brazos extendidos sin rotar', 'Retorno al pecho']),
  sideLabel: 'La polea está a un costado (detrás de la persona en esta vista); repite del otro lado.',
  caption:
    'Vista lateral: el cable sale hacia la polea situada al costado, por eso se ve corto. El tronco resiste la rotación hacia la polea.',
  pose: (t) => pallofPose(repProgress(t)),
  equipment: (rig) => pallofEquipment(gripPoint(rig, 'near')),
};

export const pallofHold: Clip = {
  id: 'v-pallof-hold',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-70, -80, 165, 190],
  floorY: FLOOR,
  seconds: 4,
  kind: 'hold',
  phases: [{ from: 0, to: 1, label: 'Mantén: brazos extendidos, sin rotar el tronco' }],
  sideLabel: 'La polea está a un costado (detrás de la persona en esta vista); repite del otro lado.',
  caption: 'Ejercicio isométrico: no hay repeticiones, se mantiene la posición durante el tiempo indicado.',
  pose: () => pallofPose(1),
  equipment: (rig) => pallofEquipment(gripPoint(rig, 'near')),
};

/* ---------- Crunch en polea alta, de rodillas ---------- */

const CC_HIP = v(0, 55);
const CC_PULLEY = v(50, -48);

function cableCrunchPose(p: number): Pose {
  const b: Pose = {
    pelvis: CC_HIP,
    abdomen: mix(22, 34, p),
    spine: mix(4, 52, p),
    neck: mix(8, 18, p),
    limbs: {
      legNear: { fk: [90, 180], end: 180 },
      legFar: { fk: [91, 181], end: 181 },
    },
  };
  const g = pointAt(b, 'head', 0.48, 10);
  return { ...b, limbs: { ...b.limbs, armNear: { ik: g, bend: 1 }, armFar: { ik: add(g, v(-1, -1)), bend: 1 } } };
}

export const cableCrunch: Clip = {
  id: 'v-cable-crunch',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-80, -65, 185, 175],
  floorY: FLOOR,
  seconds: 3.2,
  kind: 'reps',
  phases: repPhases(['Inicio: tronco erguido', 'Flexión del tronco', 'Costillas hacia la pelvis', 'Retorno controlado']),
  caption: 'La cadera queda fija; el movimiento es una flexión de la columna, no un tirón con los brazos.',
  pose: (t) => cableCrunchPose(repProgress(t)),
  equipment(rig, t) {
    const g = gripPoint(rig, 'near');
    return [
      floor(FLOOR),
      rect('mat', L.back + 0.5, v(-25, FLOOR - 1.5), 70, 3, 0, 'eq-pad', 1),
      beam('column', L.back, v(64, FLOOR), v(64, -60), 7),
      ...weightStack('stack', L.back + 0.1, v(82, FLOOR - 3), repProgress(t) * 22, 160),
      beam('arm', L.back + 0.15, v(64, -52), add(CC_PULLEY, v(2, 0)), 3),
      ...pulley('pulley', L.back + 0.2, CC_PULLEY, 3.5),
      cable('cable', L.nearArm - 0.6, [CC_PULLEY, g]),
      { key: 'rope', layer: L.nearArm + 1, d: `M${g.x - 1.2},${g.y - 3}h2.4v7h-2.4Z`, cls: 'eq-metal' },
    ];
  },
};

/* ---------- Máquina abdominal ---------- */

const abBase = seatedSide({ hip: v(0, 52), abdomen: -6, neck: 0, heelX: 30 });
const AB_PIVOT = v(8, 30);

function abMachinePose(p: number): Pose {
  const b: Pose = { ...abBase, abdomen: mix(-6, 14, p), spine: mix(0, 40, p), neck: mix(0, 12, p) };
  const g = pointAt(b, 'chest', 0.86, 15);
  return { ...b, limbs: { ...b.limbs, armNear: { ik: g, bend: 1 }, armFar: { ik: add(g, v(-1, -1)), bend: 1 } } };
}

export const abCrunchMachine: Clip = {
  id: 'v-ab-crunch-machine',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-70, -60, 165, 170],
  floorY: FLOOR,
  seconds: 3.2,
  kind: 'reps',
  phases: repPhases(['Inicio: tronco erguido', 'Flexión del tronco', 'Contracción', 'Retorno controlado']),
  caption: 'Máquina genérica con almohadillas sobre el pecho; el movimiento es una flexión del tronco.',
  pose: (t) => abMachinePose(repProgress(t)),
  equipment(_rig, t) {
    const p = repProgress(t);
    const b = abMachinePose(p);
    const padC = pointAt(b, 'chest', 0.62, 17);
    return [
      floor(FLOOR),
      beam('base', L.back, v(-50, FLOOR - 2), v(60, FLOOR - 2), 4),
      beam('seatpost', L.mid, v(2, 70), v(2, FLOOR), 5),
      pad('seat', L.mid + 0.1, v(-16, 66), v(22, 66), 8),
      pad('back', L.mid + 0.1, pointAt(abBase, 'abdomen', 0.1, -13), pointAt(abBase, 'chest', 0.5, -13), 8),
      beam('column', L.back, v(-40, FLOOR), v(-40, -50), 6),
      ...weightStack('stack', L.back + 0.1, v(-58, FLOOR - 3), p * 22, 150),
      ...lever('lever', L.torso - 1, AB_PIVOT, padC, 4),
      pad('chestpad', L.torso + 2, add(padC, v(0, -5)), add(padC, v(0, 5)), 6),
    ];
  },
};
