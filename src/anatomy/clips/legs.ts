import type { Clip, Prim, RepTiming } from '../clip';
import { mix, repPhases, repProgress } from '../clip';
import { DEG, fromUp, orientedRect } from '../geom';
import {
  barbellEnd,
  beam,
  disc,
  dumbbellEnd,
  dumbbellProfile,
  floor,
  lever,
  pad,
  rect,
  weightStack,
  L,
} from '../equipment/parts';
import { ankleFrom, gripPoint, jointPoint, solveRig, pointOn, type Pose } from '../rig';
import { add, ankleOnBall, ankleOnFloor, dir, pointAt, scale, sub, v, type Vec } from './helpers';
import { FLOOR } from './postures';

/** Bajada primero (más lenta), luego subida. */
export const DOWN_FIRST: RepTiming = { hold0: 0.08, up: 0.4, hold1: 0.08, down: 0.36 };

const STAND_ANKLE = ankleOnFloor(0, FLOOR);
const STAND_HIP = v(STAND_ANKLE.x - 1, FLOOR - 8 - 43 - 44 + 0.8);

/** Pelvis necesaria para que un punto del cuerpo quede en `target` con la pose dada. */
function pelvisFor(pose: Pose, seg: string, u: number, vv: number, target: Vec): Vec {
  const probe = pointAt({ ...pose, pelvis: v(0, 0) }, seg, u, vv);
  return sub(target, probe);
}

const seeThrough = (prims: Prim[]): Prim[] => prims.map((p) => ({ ...p, cls: `${p.cls} eq-see` }));

/* ---------- Prensa de piernas 45° ---------- */

const LP_HIP = v(-6, 64);
const RAIL = dir(-45 * DEG);
const LP_EXT = add(LP_HIP, v(58, -50));
const LP_TRAVEL = 34;
const LP_FOOT_DEG = -135;
const SOLE_MID = v(5, 8);

function legPressAnkle(p: number): Vec {
  const contact = add(LP_EXT, scale(RAIL, -LP_TRAVEL * (1 - p)));
  return ankleFrom(SOLE_MID, contact, LP_FOOT_DEG);
}

export const legPress: Clip = {
  id: 'v-leg-press',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-45, -45, 150, 155],
  floorY: FLOOR,
  seconds: 3.6,
  kind: 'reps',
  phases: repPhases(['Abajo: rodillas flexionadas', 'Empuje', 'Piernas casi extendidas', 'Descenso controlado']),
  caption: 'Prensa de carro a 45°. La cadera permanece apoyada; la profundidad depende de tu movilidad.',
  ghost: [],
  pose(t) {
    const p = repProgress(t);
    const ankle = legPressAnkle(p);
    return {
      pelvis: LP_HIP,
      abdomen: -58,
      spine: 4,
      neck: 30,
      limbs: {
        legNear: { ik: ankle, bend: -1, end: LP_FOOT_DEG },
        legFar: { ik: add(ankle, v(-1, 1)), bend: -1, end: LP_FOOT_DEG },
        armNear: { ik: v(LP_HIP.x + 10, LP_HIP.y + 4), bend: -1 },
        armFar: { ik: v(LP_HIP.x + 9, LP_HIP.y + 4), bend: -1 },
      },
    };
  },
  equipment(_rig, t) {
    const p = repProgress(t);
    const contact = add(LP_EXT, scale(RAIL, -LP_TRAVEL * (1 - p)));
    const plateCenter = add(contact, add(scale(RAIL, 8), v(0, 0)));
    const sledA = add(contact, scale({ x: -RAIL.y, y: RAIL.x }, -22));
    const sledB = add(contact, scale({ x: -RAIL.y, y: RAIL.x }, 16));
    const railStart = add(LP_HIP, v(20, 36));
    return [
      floor(FLOOR),
      beam('base', L.back, v(-60, FLOOR - 2), v(100, FLOOR - 2), 4),
      beam('rail', L.back, railStart, add(railStart, scale(RAIL, 120)), 5),
      beam('railPost', L.back, add(railStart, scale(RAIL, 110)), v(add(railStart, scale(RAIL, 110)).x, FLOOR), 5),
      beam('seatbase', L.mid - 0.2, v(-30, 80), v(10, FLOOR - 2), 5),
      pad('seat', L.mid, v(-22, LP_HIP.y + 12), v(12, LP_HIP.y + 7), 8),
      pad('back', L.mid + 0.1, pointAt({ pelvis: LP_HIP, abdomen: -58, limbs: {} }, 'abdomen', 0.2, -13), pointAt({ pelvis: LP_HIP, abdomen: -58, limbs: {} }, 'chest', 1, -13), 8),
      { key: 'platform', layer: L.nearLeg + 0.9, d: orientedRect(add(contact, scale(RAIL, 3)), 5, 44, -45 * DEG, 1.5), cls: 'eq-frame' },
      beam('sled', L.back + 0.5, sledA, add(sledA, scale(RAIL, 14)), 4),
      beam('sled2', L.back + 0.5, sledB, add(sledB, scale(RAIL, 14)), 4),
      beam('horn', L.back + 0.6, add(plateCenter, scale(RAIL, 4)), add(plateCenter, scale(RAIL, 16)), 3),
      disc('plate', L.back + 0.7, add(plateCenter, scale(RAIL, 10)), 14, 'eq-plate'),
      beam('handle', L.mid + 0.2, v(LP_HIP.x + 6, LP_HIP.y + 4), v(LP_HIP.x + 18, LP_HIP.y + 4), 3, 'eq-metal', 1.5),
    ];
  },
};

/* ---------- Sentadilla goblet ---------- */

function gobletPose(d: number): Pose {
  return {
    pelvis: v(STAND_HIP.x - 20 * d, STAND_HIP.y + 38 * d),
    abdomen: 4 + 26 * d,
    spine: 0,
    neck: -12 * d,
    limbs: {
      legNear: { ik: STAND_ANKLE, bend: -1 },
      legFar: { ik: add(STAND_ANKLE, v(-1.5, 0)), bend: -1 },
    },
  };
}

const SQUAT_PHASES = repPhases(['De pie', 'Descenso controlado', 'Abajo', 'Subida empujando el suelo'], DOWN_FIRST);

export const gobletSquat: Clip = {
  id: 'v-goblet-squat',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-75, -80, 160, 190],
  floorY: FLOOR,
  seconds: 3.8,
  kind: 'reps',
  phases: SQUAT_PHASES,
  caption: 'Mancuerna vertical pegada al pecho. La profundidad depende de tu movilidad; mantén los talones apoyados.',
  pose(t) {
    const d = repProgress(t, DOWN_FIRST);
    const b = gobletPose(d);
    const g = pointAt(b, 'chest', 0.6, 18);
    return { ...b, limbs: { ...b.limbs, armNear: { ik: g, bend: 1 }, armFar: { ik: add(g, v(-1, -1)), bend: 1 } } };
  },
  equipment(rig, t) {
    const d = repProgress(t, DOWN_FIRST);
    const g = gripPoint(rig, 'near');
    const axis = fromUp(4 + 26 * d);
    return [floor(FLOOR), ...dumbbellProfile('db', L.nearArm + 0.5, add(g, scale(dir(axis), -6)), axis, 11, 5, 15)];
  },
};

/* ---------- Sentadilla en Smith ---------- */

const SMITH_X = 2;
const smithAnkle = ankleOnFloor(SMITH_X + 6, FLOOR);

function smithSquatPose(d: number): Pose {
  const b: Pose = {
    pelvis: v(0, 0),
    abdomen: 6 + 16 * d,
    spine: 0,
    neck: -8 * d,
    limbs: {
      legNear: { ik: smithAnkle, bend: -1 },
      legFar: { ik: add(smithAnkle, v(-1.5, 0)), bend: -1 },
    },
  };
  const barY = STAND_HIP.y - 44 + 40 * d;
  const pelvis = pelvisFor(b, 'chest', 0.93, -12.5, v(SMITH_X, barY));
  const pose = { ...b, pelvis };
  const bar = v(SMITH_X, barY);
  return {
    ...pose,
    limbs: { ...pose.limbs, armNear: { ik: add(bar, v(3, 0)), bend: -1 }, armFar: { ik: add(bar, v(2, -1)), bend: -1 } },
  };
}

function smithFrame(barX: number, barY: number, top = -105): Prim[] {
  return [
    beam('smithL', L.back, v(barX - 4, FLOOR), v(barX - 4, top), 4),
    beam('smithR', L.back, v(barX + 4, FLOOR), v(barX + 4, top), 4),
    beam('smithTop', L.back, v(barX - 30, top), v(barX + 30, top), 5),
    beam('smithBase', L.back, v(barX - 45, FLOOR - 2), v(barX + 45, FLOOR - 2), 4),
    rect('carriage', L.back + 0.2, v(barX, barY), 12, 8, 0, 'eq-frame', 1.5),
    ...seeThrough(barbellEnd('bar', L.front, v(barX, barY), 15)),
  ];
}

export const smithSquat: Clip = {
  id: 'v-smith-squat',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-75, -115, 160, 225],
  floorY: FLOOR,
  seconds: 3.8,
  kind: 'reps',
  phases: SQUAT_PHASES,
  caption: 'La barra guiada sube y baja en vertical; los pies van algo adelantados. Discos translúcidos para ver el cuerpo.',
  pose: (t) => smithSquatPose(repProgress(t, DOWN_FIRST)),
  equipment(_rig, t) {
    const d = repProgress(t, DOWN_FIRST);
    return [floor(FLOOR), ...smithFrame(SMITH_X, STAND_HIP.y - 44 + 40 * d)];
  },
};

/* ---------- Peso muerto rumano ---------- */

const RDL_TIMING: RepTiming = DOWN_FIRST;
const RDL_PHASES = repPhases(['De pie', 'Bisagra de cadera', 'Abajo, espalda neutra', 'Subida extendiendo la cadera'], RDL_TIMING);

function rdlPose(h: number): Pose {
  return {
    pelvis: v(STAND_HIP.x - 18 * h, STAND_HIP.y + 6 * h),
    abdomen: 4 + 64 * h,
    spine: 0,
    neck: -6 * h,
    limbs: {
      legNear: { ik: STAND_ANKLE, bend: -1 },
      legFar: { ik: add(STAND_ANKLE, v(-1.5, 0)), bend: -1 },
      armNear: { fk: [90, 90] },
      armFar: { fk: [91, 91] },
    },
  };
}

export const dbRdl: Clip = {
  id: 'v-db-rdl',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-80, -80, 165, 190],
  floorY: FLOOR,
  seconds: 4,
  kind: 'reps',
  phases: RDL_PHASES,
  caption: 'Rodillas levemente flexionadas y fijas; la cadera va hacia atrás y las mancuernas bajan cerca de las piernas.',
  pose: (t) => rdlPose(repProgress(t, RDL_TIMING)),
  equipment(rig) {
    return [floor(FLOOR), ...dumbbellEnd('dbFar', L.farArm - 0.5, gripPoint(rig, 'far'), 7.5), ...dumbbellEnd('db', L.nearArm - 0.5, gripPoint(rig, 'near'), 7.5)];
  },
};

export const bbRdl: Clip = {
  ...dbRdl,
  id: 'v-bb-rdl',
  caption: 'Barra cerca de los muslos durante todo el recorrido. Disco translúcido para ver el cuerpo.',
  equipment(rig) {
    return [floor(FLOOR), ...seeThrough(barbellEnd('bar', L.front, gripPoint(rig, 'near'), 20))];
  },
};

/* ---------- Curl femoral acostado ---------- */

const LC_HIP = v(0, 50);
const LC_PHASES = repPhases(['Inicio: piernas extendidas', 'Flexión de rodillas', 'Contracción', 'Retorno controlado']);

function lyingCurlPose(p: number): Pose {
  const shank = 181 + 112 * p;
  const leg = { fk: [181, shank] as [number, number], end: shank - 90 };
  return {
    pelvis: LC_HIP,
    abdomen: 90,
    spine: 0,
    neck: -14,
    limbs: {
      legNear: leg,
      legFar: { ...leg, fk: [181.5, shank - 1] as [number, number] },
      armNear: { ik: v(78, 70), bend: 1 },
      armFar: { ik: v(77, 70), bend: 1 },
    },
  };
}

export const lyingLegCurl: Clip = {
  id: 'v-lying-leg-curl',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-140, -35, 245, 145],
  floorY: FLOOR,
  seconds: 3.2,
  kind: 'reps',
  phases: LC_PHASES,
  caption: 'Boca abajo, rodillas justo fuera del borde del banco; el rodillo apoya sobre los tobillos.',
  pose: (t) => lyingCurlPose(repProgress(t)),
  equipment(rig, t) {
    const p = repProgress(t);
    const knee = jointPoint(rig, 'shank.near');
    const roller = pointOn(rig.segs.get('shank.near')!, 0.88, -6);
    return [
      floor(FLOOR),
      pad('bench', L.mid, v(-40, 66), v(90, 66), 8),
      beam('post1', L.mid - 0.1, v(-30, 70), v(-30, FLOOR), 5),
      beam('post2', L.mid - 0.1, v(80, 70), v(80, FLOOR), 5),
      beam('base', L.back, v(-135, FLOOR - 2), v(95, FLOOR - 2), 4),
      beam('handles', L.mid + 0.2, v(72, 70), v(84, 70), 3, 'eq-metal', 1.5),
      beam('column', L.back, v(-112, FLOOR), v(-112, -10), 6),
      ...weightStack('stack', L.back + 0.1, v(-128, FLOOR - 3), p * 28, 100),
      ...lever('lever', L.nearLeg + 0.8, knee, roller, 3.5),
      pad('roller', L.nearLeg + 0.9, add(roller, v(-0.5, 0)), add(roller, v(0.5, 0)), 7),
    ];
  },
};

/* ---------- Curl femoral sentado ---------- */

const SC_HIP = v(0, 50);

function seatedCurlPose(p: number): Pose {
  const shank = 8 + 96 * p;
  const leg = { fk: [1, shank] as [number, number], end: shank - 90 };
  return {
    pelvis: SC_HIP,
    abdomen: -14,
    spine: 2,
    neck: 6,
    limbs: {
      legNear: leg,
      legFar: { ...leg, fk: [1.5, shank - 1] as [number, number] },
      armNear: { ik: v(12, 62), bend: -1 },
      armFar: { ik: v(11, 62), bend: -1 },
    },
  };
}

export const seatedLegCurl: Clip = {
  id: 'v-seated-leg-curl',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-60, -45, 175, 155],
  floorY: FLOOR,
  seconds: 3.2,
  kind: 'reps',
  phases: LC_PHASES,
  caption: 'Rodilla alineada con el eje de la máquina; una almohadilla fija los muslos y el rodillo va bajo los tobillos.',
  pose: (t) => seatedCurlPose(repProgress(t)),
  equipment(rig, t) {
    const p = repProgress(t);
    const knee = jointPoint(rig, 'shank.near');
    const roller = pointOn(rig.segs.get('shank.near')!, 0.88, -6.5);
    const base = seatedCurlPose(0);
    return [
      floor(FLOOR),
      beam('base', L.back, v(-40, FLOOR - 2), v(100, FLOOR - 2), 4),
      pad('seat', L.mid, v(-16, 64), v(34, 64), 8),
      beam('seatpost', L.mid - 0.1, v(10, 68), v(10, FLOOR), 5),
      pad('back', L.mid + 0.1, pointAt(base, 'abdomen', 0.1, -13), pointAt(base, 'chest', 0.95, -13), 8),
      beam('backpost', L.mid - 0.1, pointAt(base, 'abdomen', 0.4, -18), v(-30, FLOOR), 4),
      pad('thighpad', L.nearLeg + 1, v(26, 36.5), v(40, 36.5), 6),
      beam('column', L.back, v(-45, FLOOR), v(-45, -40), 6),
      ...weightStack('stack', L.back + 0.1, v(-62, FLOOR - 3), p * 28, 135),
      ...lever('lever', L.nearLeg + 0.8, knee, roller, 3.5),
      pad('roller', L.nearLeg + 0.9, add(roller, v(-0.5, 0)), add(roller, v(0.5, 0)), 7),
    ];
  },
};

/* ---------- Extensión de cuádriceps ---------- */

function legExtensionPose(p: number): Pose {
  const shank = 96 - 88 * p;
  const leg = { fk: [2, shank] as [number, number], end: shank - 90 };
  return {
    pelvis: v(0, 50),
    abdomen: -6,
    spine: 0,
    neck: 2,
    limbs: {
      legNear: leg,
      legFar: { ...leg, fk: [2.5, shank - 1] as [number, number] },
      armNear: { ik: v(12, 62), bend: -1 },
      armFar: { ik: v(11, 62), bend: -1 },
    },
  };
}

export const legExtension: Clip = {
  id: 'v-leg-extension',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-60, -45, 175, 155],
  floorY: FLOOR,
  seconds: 3.2,
  kind: 'reps',
  phases: repPhases(['Inicio: rodillas flexionadas', 'Extensión de rodillas', 'Piernas casi extendidas', 'Descenso controlado']),
  caption: 'Rodilla alineada con el eje de la máquina; el rodillo apoya en la parte baja de la espinilla.',
  pose: (t) => legExtensionPose(repProgress(t)),
  equipment(rig, t) {
    const p = repProgress(t);
    const knee = jointPoint(rig, 'shank.near');
    const roller = pointOn(rig.segs.get('shank.near')!, 0.86, 6.5);
    const base = legExtensionPose(0);
    return [
      floor(FLOOR),
      beam('base', L.back, v(-40, FLOOR - 2), v(80, FLOOR - 2), 4),
      pad('seat', L.mid, v(-16, 64), v(42, 64), 8),
      beam('seatpost', L.mid - 0.1, v(10, 68), v(10, FLOOR), 5),
      pad('back', L.mid + 0.1, pointAt(base, 'abdomen', 0.1, -13), pointAt(base, 'chest', 0.95, -13), 8),
      beam('backpost', L.mid - 0.1, pointAt(base, 'abdomen', 0.4, -18), v(-30, FLOOR), 4),
      beam('column', L.back, v(-45, FLOOR), v(-45, -40), 6),
      ...weightStack('stack', L.back + 0.1, v(-62, FLOOR - 3), p * 28, 135),
      ...lever('lever', L.nearLeg + 0.8, knee, roller, 3.5),
      pad('roller', L.nearLeg + 0.9, add(roller, v(-0.5, 0)), add(roller, v(0.5, 0)), 7),
    ];
  },
};

/* ---------- Elevación de pantorrillas ---------- */

const STEP_TOP = FLOOR - 12;
const BALL = v(12, STEP_TOP);
const CALF_PHASES = repPhases(['Abajo: talones bajo el escalón', 'Subida en puntillas', 'Pausa arriba', 'Descenso lento']);

function calfBase(p: number): Pose {
  const footDeg = mix(-22, 32, p);
  const ankle = ankleOnBall(BALL, footDeg);
  return {
    pelvis: v(ankle.x - 1, ankle.y - 86.2),
    abdomen: 0,
    spine: 0,
    neck: 0,
    limbs: {
      legNear: { ik: ankle, bend: -1, end: footDeg },
      legFar: { ik: add(ankle, v(-1.5, 0)), bend: -1, end: footDeg },
    },
  };
}

function stepBlock(): Prim {
  return rect('step', L.nearLeg + 0.95, v(BALL.x - 4, STEP_TOP + 6), 22, 12, 0, 'eq-frame', 1.5);
}

export const standingCalfMachine: Clip = {
  id: 'v-standing-calf-machine',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-70, -95, 150, 205],
  floorY: FLOOR,
  seconds: 2.8,
  kind: 'reps',
  phases: CALF_PHASES,
  caption: 'Hombros bajo las almohadillas y rodillas casi extendidas; el giro ocurre en el tobillo.',
  pose(t) {
    const b = calfBase(repProgress(t));
    const sh = jointPoint(solveRig('side', b), 'upperArm.near');
    const g = add(sh, v(8, -12));
    return { ...b, limbs: { ...b.limbs, armNear: { ik: g, bend: 1 }, armFar: { ik: add(g, v(-1, -1)), bend: 1 } } };
  },
  equipment(rig, t) {
    const p = repProgress(t);
    const sh = jointPoint(rig, 'upperArm.near');
    const padC = add(sh, v(0, -6));
    return [
      floor(FLOOR),
      stepBlock(),
      beam('column', L.back, v(-40, FLOOR), v(-40, -95), 7),
      ...weightStack('stack', L.back + 0.1, v(-58, FLOOR - 3), p * 14, 170),
      beam('carriage', L.back + 0.3, v(-40, padC.y), add(padC, v(-2, 0)), 5),
      pad('shoulderpad', L.nearArm + 0.8, add(padC, v(-7, 0)), add(padC, v(7, 0)), 7),
      beam('base', L.back, v(-60, FLOOR - 2), v(40, FLOOR - 2), 4),
    ];
  },
};

export const dbCalfRaise: Clip = {
  id: 'v-db-calf-raise',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-70, -95, 150, 205],
  floorY: FLOOR,
  seconds: 2.8,
  kind: 'reps',
  phases: CALF_PHASES,
  caption: 'Sobre un escalón estable con una mancuerna en cada mano.',
  pose(t) {
    const b = calfBase(repProgress(t));
    return { ...b, limbs: { ...b.limbs, armNear: { fk: [90, 90] }, armFar: { fk: [91, 91] } } };
  },
  equipment(rig) {
    return [
      floor(FLOOR),
      stepBlock(),
      ...dumbbellEnd('dbFar', L.farArm - 0.5, gripPoint(rig, 'far'), 7.5),
      ...dumbbellEnd('db', L.nearArm - 0.5, gripPoint(rig, 'near'), 7.5),
    ];
  },
};

export const smithCalfRaise: Clip = {
  id: 'v-smith-calf-raise',
  view: 'side',
  viewLabel: 'Vista lateral',
  viewBox: [-75, -115, 160, 225],
  floorY: FLOOR,
  seconds: 2.8,
  kind: 'reps',
  phases: CALF_PHASES,
  caption: 'Barra guiada sobre la parte alta de la espalda; escalón bajo la parte delantera de los pies.',
  pose(t) {
    const b = calfBase(repProgress(t));
    const bar = pointAt(b, 'chest', 0.93, -12.5);
    return { ...b, limbs: { ...b.limbs, armNear: { ik: add(bar, v(3, 0)), bend: -1 }, armFar: { ik: add(bar, v(2, -1)), bend: -1 } } };
  },
  equipment(_rig, t) {
    const b = calfBase(repProgress(t));
    const bar = pointAt(b, 'chest', 0.93, -12.5);
    return [floor(FLOOR), stepBlock(), ...smithFrame(bar.x, bar.y, -125)];
  },
};

export { smithFrame, pelvisFor, seeThrough, STAND_ANKLE, STAND_HIP, dir };
