import type { Clip } from '../clip';
import { mix, repPhases, repProgress } from '../clip';
import { bar } from '../geom';
import { beam, cable, cablePath, disc, floor, lever, pad, pulley, rect, weightStack, L } from '../equipment/parts';
import { gripPoint, type Pose } from '../rig';
import { add, ankleOnFloor, arc, arcAround, dist, lerpV, pointAt, shoulderAt, v } from './helpers';
import { FLOOR, seatedCoronal, seatedSide } from './postures';

const PULL_PHASES = repPhases(['Inicio: brazos extendidos', 'Tirón', 'Contracción', 'Retorno controlado']);

/* ---------- Jalón al pecho (vista lateral: agarres supino y neutro) ---------- */

const PD_HIP = v(0, 52);
const PD_TOP_Y = -118;

function pulldownSideClip(id: string, grip: 'supino' | 'neutro'): Clip {
  const base = seatedSide({ hip: PD_HIP, abdomen: -6, spine: 0, neck: 0, heelX: 36 });
  const poseAt = (p: number): Pose => ({ ...base, abdomen: mix(-4, -14, p), neck: mix(-6, 4, p) });
  return {
    id,
    view: 'side',
    viewLabel: 'Vista lateral',
    viewBox: [-80, -135, 175, 245],
    floorY: FLOOR,
    seconds: 3.4,
    kind: 'reps',
    phases: PULL_PHASES,
    caption:
      grip === 'supino'
        ? 'Agarre supino (palmas hacia ti) al ancho de los hombros. Inclinación del tronco leve, sin balanceo.'
        : 'Agarre neutro (palmas enfrentadas). Inclinación del tronco leve, sin balanceo.',
    pose(t) {
      const p = repProgress(t);
      const b = poseAt(p);
      const sh = shoulderAt(b);
      const start = add(sh, v(9, -56));
      const end = add(sh, v(17, 3));
      const g = lerpV(start, end, p);
      const arm = { ik: g, bend: 1 as const, scale: 0.97, scale2: 0.97 };
      return { ...b, limbs: { ...b.limbs, armNear: arm, armFar: { ...arm, ik: add(g, v(-1, -1)) } } };
    },
    equipment(rig) {
      const g = gripPoint(rig, 'near');
      const top = v(g.x, PD_TOP_Y);
      const back = v(-52, PD_TOP_Y);
      const startG = add(shoulderAt(poseAt(0)), v(9, -56));
      const lift = dist(top, g) - dist(top, startG);
      return [
        floor(FLOOR),
        beam('base', L.back, v(-75, FLOOR - 2), v(45, FLOOR - 2), 4),
        beam('column', L.back, v(-58, FLOOR), v(-58, PD_TOP_Y - 4), 6),
        beam('boom', L.back, v(-60, PD_TOP_Y - 4), v(top.x + 6, PD_TOP_Y - 4), 5),
        ...weightStack('stack', L.back + 0.1, v(-38, FLOOR - 3), lift, 150),
        ...pulley('pTop', L.back + 0.2, top, 3.5),
        ...pulley('pBack', L.back + 0.2, back, 3.5),
        cable('cable', L.torso - 1, [g, top, back, v(back.x, FLOOR - 40)]),
        beam('seatpost', L.mid, v(0, 70), v(0, FLOOR), 5),
        pad('seat', L.mid + 0.1, v(-16, 66), v(22, 66), 8),
        beam('padpost', L.back + 0.3, v(36, 34), v(36, FLOOR), 4),
        pad('thighpad', L.nearLeg + 1, v(28, 40.5), v(42, 40.5), 7),
        rect('bar', L.nearArm - 0.5, g, 4.5, 4.5, 0, 'eq-metal', 2),
        disc('barEnd', L.nearArm + 1, g, 1.6, 'eq-metal'),
      ];
    },
  };
}

export const latPulldownSupine = pulldownSideClip('v-lat-pulldown-supine', 'supino');
export const latPulldownNeutral = pulldownSideClip('v-lat-pulldown-neutral', 'neutro');

/* ---------- Jalón al pecho, agarre prono ancho (vista posterior) ---------- */

const PDW_HIP_Y = 52;
const pdwBase = seatedCoronal(PDW_HIP_Y, { spread: 12, thighScale: 0.2 });
const pdwShoulderL = shoulderAt(pdwBase, 'rear', 'L');

export const latPulldownWide: Clip = {
  id: 'v-lat-pulldown-wide',
  view: 'rear',
  viewLabel: 'Vista posterior',
  viewBox: [-100, -140, 200, 250],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: PULL_PHASES,
  caption: 'Vista desde atrás: la barra pasa por delante del cuerpo y queda oculta tras la espalda al final.',
  pose(t) {
    const p = repProgress(t);
    // En vista posterior el lado L de la persona queda a la izquierda del observador (x negativa).
    const gL = add(pdwShoulderL, v(mix(-27, -21, p), mix(-55, -2, p)));
    const gR = v(-gL.x, gL.y);
    return {
      ...pdwBase,
      limbs: {
        ...pdwBase.limbs,
        armL: { ik: gL, bend: -1, scale: 0.95, scale2: mix(0.98, 0.8, p) },
        armR: { ik: gR, bend: 1, scale: 0.95, scale2: mix(0.98, 0.8, p) },
      },
    };
  },
  equipment(rig) {
    const gL = gripPoint(rig, 'L');
    const gR = gripPoint(rig, 'R');
    const mid = lerpV(gL, gR, 0.5);
    const top = v(0, PD_TOP_Y);
    return [
      floor(FLOOR),
      beam('column', L.back - 0.5, v(0, FLOOR), v(0, PD_TOP_Y - 6), 7),
      ...pulley('pTop', L.back, top, 4),
      cable('cable', L.torso - 1, [top, mid]),
      { key: 'bar', layer: L.torso - 0.8, d: bar(add(gL, v(-12, 0)), add(gR, v(12, 0)), 3.2, 1.5), cls: 'eq-metal' },
      pad('seat', L.nearLeg + 1, v(-20, PDW_HIP_Y + 13), v(20, PDW_HIP_Y + 13), 7),
      beam('seatpost', L.nearLeg + 0.9, v(0, PDW_HIP_Y + 16), v(0, FLOOR), 6),
      beam('foot', L.back, v(-30, FLOOR - 2), v(30, FLOOR - 2), 4),
    ];
  },
};

/* ---------- Remo sentado en máquina ---------- */

const rowBase = seatedSide({ hip: v(0, 52), abdomen: 2, spine: 0, neck: 0, heelX: 34 });
const rowShoulder = shoulderAt(rowBase);
const ROW_START = add(rowShoulder, v(54, 12));
const ROW_END = add(rowShoulder, v(14, 14));
const rowPath = arc(ROW_START, ROW_END, 75, -1);
const rowChest0 = pointAt(rowBase, 'chest', 0.3, 13.8);
const rowChest1 = pointAt(rowBase, 'chest', 0.85, 13.8);

export const seatedRowMachine: Clip = {
  id: 'v-seated-row-machine',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-75, -50, 175, 160],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: PULL_PHASES,
  caption: 'Máquina genérica con apoyo de pecho; el pecho no se separa del apoyo.',
  pose(t) {
    const p = repProgress(t);
    const g = rowPath.at(p);
    const arm = { ik: g, bend: 1 as const, scale: 0.96, scale2: 0.96 };
    return { ...rowBase, limbs: { ...rowBase.limbs, armNear: arm, armFar: { ...arm, ik: add(g, v(-1, -1)) } } };
  },
  equipment(rig, t) {
    const p = repProgress(t);
    const g = gripPoint(rig, 'near');
    return [
      floor(FLOOR),
      beam('base', L.back, v(-35, FLOOR - 2), v(95, FLOOR - 2), 4),
      beam('upright', L.back, v(70, FLOOR), v(70, -40), 6),
      ...weightStack('stack', L.back + 0.1, v(88, FLOOR - 3), rowPath.travel(p) * 0.45, 140),
      beam('padarm', L.mid, add(rowChest0, v(8, 0)), v(70, 20), 4),
      pad('chestpad', L.torso + 2, add(rowChest0, v(3.5, 0)), add(rowChest1, v(3.5, 0)), 7),
      beam('seatpost', L.mid, v(2, 70), v(2, FLOOR), 5),
      pad('seat', L.mid + 0.1, v(-16, 66), v(22, 66), 8),
      ...lever('lever', L.torso - 1, rowPath.pivot, g, 4.5),
      rect('handle', L.nearArm - 0.5, g, 4, 4, 0, 'eq-metal', 2),
      disc('handleEnd', L.nearArm + 1, g, 1.6, 'eq-metal'),
    ];
  },
};

/* ---------- Remo sentado en polea baja ---------- */

const CR_HIP = v(-12, 72);
const CR_PULLEY = v(78, 88);
const crAnkle = v(64, 86);

function cableRowPose(p: number): Pose {
  const base: Pose = {
    pelvis: CR_HIP,
    abdomen: mix(14, 0, p),
    spine: mix(4, 0, p),
    neck: 0,
    limbs: {
      legNear: { ik: crAnkle, bend: -1, end: -80 },
      legFar: { ik: add(crAnkle, v(-1, -2)), bend: -1, end: -80 },
    },
  };
  return base;
}

export const seatedCableRow: Clip = {
  id: 'v-seated-cable-row',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-60, -20, 165, 130],
  floorY: FLOOR,
  seconds: 3.6,
  kind: 'reps',
  phases: PULL_PHASES,
  caption: 'Tronco casi erguido: se permite una inclinación leve al estirar, sin balanceo para mover la carga.',
  pose(t) {
    const p = repProgress(t);
    const b = cableRowPose(p);
    const sh = shoulderAt(b);
    const g = add(sh, v(mix(56, 16, p), mix(20, 27, p)));
    const arm = { ik: g, bend: 1 as const, scale: 0.97, scale2: 0.97 };
    return { ...b, limbs: { ...b.limbs, armNear: arm, armFar: { ...arm, ik: add(g, v(-1, -1)) } } };
  },
  equipment(rig) {
    const g = gripPoint(rig, 'near');
    const g0 = (() => {
      const b = cableRowPose(0);
      return add(shoulderAt(b), v(56, 20));
    })();
    const lift = dist(CR_PULLEY, g) - dist(CR_PULLEY, g0);
    return [
      floor(FLOOR),
      beam('rail', L.back, v(-40, FLOOR - 2), v(100, FLOOR - 2), 4),
      pad('bench', L.mid, v(-40, CR_HIP.y + 14), v(30, CR_HIP.y + 14), 8),
      beam('bpost1', L.mid - 0.1, v(-30, CR_HIP.y + 18), v(-30, FLOOR), 4),
      beam('bpost2', L.mid - 0.1, v(20, CR_HIP.y + 18), v(20, FLOOR), 4),
      rect('footplate', L.nearLeg + 1, v(73, 86), 5, 26, -0.15, 'eq-frame', 1.5),
      beam('column', L.back, v(92, FLOOR), v(92, -20), 6),
      ...weightStack('stack', L.back + 0.1, v(108, FLOOR - 3), lift, 125),
      ...pulley('pulley', L.back + 0.2, CR_PULLEY, 3.5),
      cable('cable', L.nearArm - 0.6, [g, CR_PULLEY]),
      { key: 'vhandle', layer: L.nearArm + 1, d: bar(add(g, v(-1, -3)), add(g, v(4, 2)), 3, 1.4), cls: 'eq-metal' },
    ];
  },
};

/* ---------- Remo con apoyo de pecho inclinado ---------- */

const CS_HIP = v(-32, 30);
const csAnkle = ankleOnFloor(-16, FLOOR);
const csBase: Pose = {
  pelvis: CS_HIP,
  abdomen: 46,
  spine: 2,
  neck: -22,
  limbs: { legNear: { ik: csAnkle, bend: -1 }, legFar: { ik: add(csAnkle, v(-2, 0)), bend: -1 } },
};
const csShoulder = shoulderAt(csBase);
const CS_START = add(csShoulder, v(6, 55));
const csPath = arcAround(v(csShoulder.x + 62, FLOOR - 8), CS_START, -24);
const csPad0 = pointAt(csBase, 'abdomen', 0.75, 13.5);
const csPad1 = pointAt(csBase, 'chest', 0.95, 15);

export const chestSupportedRow: Clip = {
  id: 'v-chest-supported-row',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-80, -60, 180, 170],
  floorY: FLOOR,
  seconds: 3.4,
  kind: 'reps',
  phases: PULL_PHASES,
  caption: 'Máquina genérica de remo con el pecho apoyado en una almohadilla inclinada y los pies en la plataforma.',
  pose(t) {
    const p = repProgress(t);
    const g = csPath.at(p);
    const arm = { ik: g, bend: -1 as const, scale: 0.96, scale2: 0.96 };
    return { ...csBase, limbs: { ...csBase.limbs, armNear: arm, armFar: { ...arm, ik: add(g, v(-1, -1)) } } };
  },
  equipment(rig, t) {
    const p = repProgress(t);
    const g = gripPoint(rig, 'near');
    return [
      floor(FLOOR),
      rect('platform', L.back, v(-14, FLOOR - 3), 50, 6, 0, 'eq-frame', 1),
      pad('chestpad', L.torso + 2, add(csPad0, v(2.5, 2.5)), add(csPad1, v(2.5, 2.5)), 8),
      beam('padpost', L.mid, add(csPad0, v(4, 8)), v(-6, FLOOR - 4), 5),
      beam('upright', L.back, v(72, FLOOR), v(72, -30), 6),
      ...weightStack('stack', L.back + 0.1, v(90, FLOOR - 3), csPath.travel(p) * 0.45, 125),
      ...lever('lever', L.torso - 1, csPath.pivot, g, 4.5),
      rect('handle', L.nearArm - 0.5, g, 4, 4, 0, 'eq-metal', 2),
      disc('handleEnd', L.nearArm + 1, g, 1.6, 'eq-metal'),
    ];
  },
};

export { ankleOnFloor, cablePath };
