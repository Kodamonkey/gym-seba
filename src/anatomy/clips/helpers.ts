import { add, angleOf, dist, dir, lerp, lerpV, scale, sub, v, type Vec } from '../geom';
import { ankleFrom, FOOT, jointPoint, solveRig, type Pose, type View } from '../rig';

export { v, add, sub, lerp, lerpV, dist, dir, scale, angleOf };
export type { Vec };

/** Hombro (vista lateral) para una pose base del tronco. */
export function shoulderAt(pose: Pose, view: View = 'side', side = 'near'): Vec {
  return jointPoint(solveRig(view, pose), `upperArm.${side}`);
}

export function hipAt(pose: Pose, view: View = 'side', side = 'near'): Vec {
  return jointPoint(solveRig(view, pose), `thigh.${side}`);
}

export function pointAt(pose: Pose, seg: string, u: number, vv: number, view: View = 'side'): Vec {
  const rig = solveRig(view, pose);
  const s = rig.segs.get(seg)!;
  const a = dir(s.a);
  const n = { x: -a.y, y: a.x };
  return add(s.o, add(scale(a, u * s.len * s.scale), scale(n, vv * s.mirror)));
}

/**
 * Trayectoria en arco entre dos puntos alrededor de un pivote (palancas de máquina).
 * `bulge` > 0 coloca el pivote a un lado de la cuerda S→E; < 0 al otro.
 */
export function arc(S: Vec, E: Vec, radius: number, bulge: 1 | -1 = 1) {
  const chord = dist(S, E);
  const r = Math.max(radius, chord / 2 + 0.01);
  const M = lerpV(S, E, 0.5);
  const h = Math.sqrt(r * r - (chord / 2) * (chord / 2));
  const d = sub(E, S);
  const perp = { x: (-d.y / chord) * bulge, y: (d.x / chord) * bulge };
  const pivot = add(M, scale(perp, h));
  const a0 = angleOf(sub(S, pivot));
  let a1 = angleOf(sub(E, pivot));
  if (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
  if (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
  return {
    pivot,
    radius: r,
    angle: (p: number) => lerp(a0, a1, p),
    at: (p: number) => add(pivot, scale(dir(lerp(a0, a1, p)), r)),
    /** Recorrido del extremo en cm (para derivar la pila). */
    travel: (p: number) => Math.abs(a1 - a0) * r * p,
  };
}

/** Tobillo con el pie apoyado plano en un suelo/plataforma con la planta en `soleY`. */
export function ankleOnFloor(heelX: number, soleY: number, footDeg = 0): Vec {
  return ankleFrom(FOOT.heel, v(heelX, soleY), footDeg);
}

/** Tobillo pivotando sobre la base de los dedos (elevación de talones). */
export function ankleOnBall(ball: Vec, footDeg: number): Vec {
  return ankleFrom(FOOT.ball, ball, footDeg);
}

/** Arco alrededor de un pivote dado, desde `start` girando `deltaDeg` grados. */
export function arcAround(pivot: Vec, start: Vec, deltaDeg: number) {
  const r = dist(pivot, start);
  const a0 = angleOf(sub(start, pivot));
  const a1 = a0 + (deltaDeg * Math.PI) / 180;
  return {
    pivot,
    radius: r,
    at: (p: number) => add(pivot, scale(dir(lerp(a0, a1, p)), r)),
    travel: (p: number) => Math.abs(a1 - a0) * r * p,
  };
}
