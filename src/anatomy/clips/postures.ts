import { DIM, type LimbPose, type Pose } from '../rig';
import { ankleOnFloor, v, type Vec } from './helpers';

/** Posturas base reutilizables. Coordenadas en cm, suelo en `FLOOR`. */

export const FLOOR = 105;
/** Altura de la cadera de pie con piernas extendidas. */
export const STAND_HIP_Y = FLOOR - DIM.ankleHeight - DIM.shank - DIM.thigh + 0.6;

export interface SeatedOpts {
  hip: Vec;
  abdomen?: number;
  spine?: number;
  neck?: number;
  /** x del talón apoyado en el suelo. */
  heelX: number;
  floorY?: number;
}

/** Sentado con los pies apoyados en el suelo (vista lateral). */
export function seatedSide(o: SeatedOpts): Pose {
  const ankle = ankleOnFloor(o.heelX, o.floorY ?? FLOOR);
  return {
    pelvis: o.hip,
    abdomen: o.abdomen ?? 0,
    spine: o.spine ?? 0,
    neck: o.neck ?? 0,
    limbs: {
      legNear: { ik: ankle, bend: -1 },
      legFar: { ik: v(ankle.x - 2, ankle.y), bend: -1 },
    },
  };
}

export interface StandingOpts {
  /** x del talón del pie cercano. */
  heelX: number;
  hip?: Vec;
  abdomen?: number;
  spine?: number;
  neck?: number;
  floorY?: number;
  farHeelOffset?: number;
}

/** De pie (vista lateral). Si no se da la cadera, piernas casi extendidas sobre los pies. */
export function standingSide(o: StandingOpts): Pose {
  const floorY = o.floorY ?? FLOOR;
  const ankle = ankleOnFloor(o.heelX, floorY);
  const hip = o.hip ?? v(ankle.x - 1, floorY - DIM.ankleHeight - DIM.shank - DIM.thigh + 0.8);
  const off = o.farHeelOffset ?? -1.5;
  return {
    pelvis: hip,
    abdomen: o.abdomen ?? 0,
    spine: o.spine ?? 0,
    neck: o.neck ?? 0,
    limbs: {
      legNear: { ik: ankle, bend: -1 },
      legFar: { ik: v(ankle.x + off, ankle.y), bend: -1 },
    },
  };
}

/** De pie (vistas frontal/posterior). */
export function standingCoronal(opts: { stance?: number; hipY?: number; abdomen?: number } = {}): Pose {
  const stance = opts.stance ?? 2;
  return {
    pelvis: v(0, opts.hipY ?? STAND_HIP_Y),
    abdomen: opts.abdomen ?? 0,
    spine: 0,
    neck: 0,
    limbs: {
      legL: { fk: [90 - stance, 90] },
      legR: { fk: [90 + stance, 90] },
    },
  };
}

/** Sentado visto de frente o de espaldas: muslos en escorzo hacia el observador. */
export function seatedCoronal(hipY: number, opts: { spread?: number; thighScale?: number } = {}): Pose {
  const spread = opts.spread ?? 10;
  const thighScale = opts.thighScale ?? 0.2;
  const knee = hipY + DIM.thigh * thighScale;
  const shankScale = Math.min(1, (FLOOR - DIM.ankleHeight - knee) / DIM.shank);
  const leg = (deg: number): LimbPose => ({ fk: [deg, 90], scale: thighScale, scale2: shankScale });
  return {
    pelvis: v(0, hipY),
    abdomen: 0,
    spine: 0,
    neck: 0,
    limbs: { legL: leg(90 - spread), legR: leg(90 + spread) },
  };
}
