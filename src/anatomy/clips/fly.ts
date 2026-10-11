import type { Clip } from '../clip';
import { repPhases, repProgress } from '../clip';
import { DEG } from '../geom';
import { beam, cable, floor, pad, pulley, rect, L } from '../equipment/parts';
import { gripPoint, type Pose } from '../rig';
import { add, v } from './helpers';
import { FLOOR, seatedCoronal, standingCoronal } from './postures';
import { shoulderAt } from './helpers';

const FLY_PHASES = repPhases(['Inicio: brazos al frente', 'Apertura hacia atrás', 'Brazos en línea con los hombros', 'Retorno controlado']);

/**
 * Abducción horizontal vista desde atrás: los brazos se acortan por el escorzo cuando
 * apuntan hacia delante (se alejan del observador) y se ven completos al abrirse.
 */
function flyArms(base: Pose, p: number, droop = 4): Pose {
  const theta = (12 + 82 * p) * DEG;
  const s = Math.max(0.12, Math.sin(theta));
  // En vista posterior el lado L de la persona está a la izquierda del observador (x negativa).
  return {
    ...base,
    limbs: {
      ...base.limbs,
      armL: { fk: [180 - droop, 180 - droop + 10], scale: s, scale2: s },
      armR: { fk: [droop, droop - 10], scale: s, scale2: s },
    },
  };
}

/* ---------- Aperturas inversas en máquina ---------- */

const RD_HIP_Y = 52;
const rdBase = seatedCoronal(RD_HIP_Y, { spread: 12, thighScale: 0.2 });
const rdShoulder = shoulderAt(rdBase, 'rear', 'L');

export const reversePecDeck: Clip = {
  id: 'v-reverse-pec-deck',
  view: 'rear',
  viewLabel: 'Vista posterior',
  viewBox: [-100, -95, 200, 205],
  floorY: FLOOR,
  seconds: 3.2,
  kind: 'reps',
  phases: FLY_PHASES,
  caption:
    'Vista desde atrás. Al inicio los brazos apuntan hacia delante y se ven acortados (escorzo); la máquina y la almohadilla quedan delante de la persona.',
  pose: (t) => flyArms(rdBase, repProgress(t)),
  equipment(rig) {
    const gL = gripPoint(rig, 'L');
    const gR = gripPoint(rig, 'R');
    const top = v(0, rdShoulder.y - 34);
    return [
      floor(FLOOR),
      beam('tower', L.back - 0.5, v(0, FLOOR), v(0, top.y - 6), 8),
      beam('levL', L.back, top, add(gL, v(0, -7)), 3.5),
      beam('levR', L.back, top, add(gR, v(0, -7)), 3.5),
      rect('hL', L.nearArm + 1, gL, 3.2, 13, 0, 'eq-metal', 1.4),
      rect('hR', L.nearArm + 1, gR, 3.2, 13, 0, 'eq-metal', 1.4),
      pad('seat', L.nearLeg + 1, v(-20, RD_HIP_Y + 13), v(20, RD_HIP_Y + 13), 7),
      beam('seatpost', L.nearLeg + 0.9, v(0, RD_HIP_Y + 16), v(0, FLOOR), 6),
      beam('foot', L.back, v(-30, FLOOR - 2), v(30, FLOOR - 2), 4),
    ];
  },
};

/* ---------- Aperturas inversas en polea (cables cruzados) ---------- */

const cfBase = standingCoronal({ stance: 4 });
const cfShoulder = shoulderAt(cfBase, 'rear', 'L');
const PULLEY_Y = cfShoulder.y - 4;

export const cableReverseFly: Clip = {
  id: 'v-cable-reverse-fly',
  view: 'rear',
  viewLabel: 'Vista posterior',
  viewBox: [-110, -95, 220, 205],
  floorY: FLOOR,
  seconds: 3.2,
  kind: 'reps',
  phases: FLY_PHASES,
  caption: 'Cables cruzados: cada mano toma el cable de la polea del lado contrario. Brazos acortados por el escorzo al inicio.',
  pose: (t) => flyArms(cfBase, repProgress(t), 2),
  equipment(rig) {
    const gL = gripPoint(rig, 'L');
    const gR = gripPoint(rig, 'R');
    const pL = v(-88, PULLEY_Y);
    const pR = v(88, PULLEY_Y);
    return [
      floor(FLOOR),
      beam('colL', L.back - 0.5, v(-95, FLOOR), v(-95, -90), 7),
      beam('colR', L.back - 0.5, v(95, FLOOR), v(95, -90), 7),
      ...pulley('pulL', L.back, pL, 3.5),
      ...pulley('pulR', L.back, pR, 3.5),
      cable('cabL', L.torso - 1, [pR, gL]),
      cable('cabR', L.torso - 1, [pL, gR]),
      rect('hL', L.nearArm + 1, gL, 3.6, 3.6, 0, 'eq-metal', 1.8),
      rect('hR', L.nearArm + 1, gR, 3.6, 3.6, 0, 'eq-metal', 1.8),
    ];
  },
};
