/** Geometría 2D mínima para el rig (unidades: cm, eje y hacia abajo como en SVG). */

export type Vec = { x: number; y: number };

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const DEG = Math.PI / 180;
export const dir = (rad: number): Vec => ({ x: Math.cos(rad), y: Math.sin(rad) });
export const angleOf = (a: Vec): number => Math.atan2(a.y, a.x);
export const rotate = (a: Vec, rad: number): Vec => ({
  x: a.x * Math.cos(rad) - a.y * Math.sin(rad),
  y: a.x * Math.sin(rad) + a.y * Math.cos(rad),
});
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerpV = (a: Vec, b: Vec, t: number): Vec => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Ángulo "desde la vertical hacia arriba" en grados (+ = hacia +x) a ángulo de eje en radianes. */
export const fromUp = (deg: number): number => (-90 + deg) * DEG;

const f = (n: number) => (Math.round(n * 100) / 100).toString();

/** Contorno cerrado suave (Catmull-Rom → Bézier). */
export function smoothClosed(points: Vec[], tension = 1): string {
  const n = points.length;
  if (n < 3) return '';
  let d = `M${f(points[0]!.x)},${f(points[0]!.y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n]!;
    const p1 = points[i]!;
    const p2 = points[(i + 1) % n]!;
    const p3 = points[(i + 2) % n]!;
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += `C${f(c1.x)},${f(c1.y)} ${f(c2.x)},${f(c2.y)} ${f(p2.x)},${f(p2.y)}`;
  }
  return d + 'Z';
}

export function polygon(points: Vec[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)},${f(p.y)}`).join('') + 'Z';
}

export function polyline(points: Vec[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)},${f(p.y)}`).join('');
}

export function circle(c: Vec, r: number): string {
  return `M${f(c.x - r)},${f(c.y)}a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0Z`;
}

/** Rectángulo orientado con esquinas redondeadas: centro, ancho (eje), alto, ángulo (rad). */
export function orientedRect(center: Vec, w: number, h: number, rad = 0, r = 0): string {
  const hw = w / 2;
  const hh = h / 2;
  if (r <= 0) {
    const pts = [v(-hw, -hh), v(hw, -hh), v(hw, hh), v(-hw, hh)].map((p) => add(center, rotate(p, rad)));
    return polygon(pts);
  }
  const rr = Math.min(r, hw, hh);
  const pts: Vec[] = [];
  const corners: [number, number, number][] = [
    [hw - rr, -hh + rr, -90],
    [hw - rr, hh - rr, 0],
    [-hw + rr, hh - rr, 90],
    [-hw + rr, -hh + rr, 180],
  ];
  for (const [cx, cy, start] of corners) {
    for (let k = 0; k <= 4; k++) {
      const a = (start + (k * 90) / 4) * DEG;
      pts.push(add(center, rotate(v(cx + rr * Math.cos(a), cy + rr * Math.sin(a)), rad)));
    }
  }
  return polygon(pts);
}

/** Rectángulo entre dos puntos (barra, cable grueso, riel) con grosor. */
export function bar(a: Vec, b: Vec, thickness: number, r = 0): string {
  const c = lerpV(a, b, 0.5);
  return orientedRect(c, dist(a, b), thickness, angleOf(sub(b, a)), r);
}

/**
 * IK analítica de dos huesos. Devuelve la posición de la articulación intermedia
 * (codo/rodilla) y el extremo efectivamente alcanzado (acotado al alcance).
 * `bend` elige el lado hacia el que se dobla la articulación.
 */
export function ik2(root: Vec, target: Vec, l1: number, l2: number, bend: 1 | -1): { joint: Vec; end: Vec } {
  const toT = sub(target, root);
  const d0 = len(toT);
  const d = clamp(d0, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01);
  const base = angleOf(toT);
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const a = Math.acos(cosA);
  const upper = base + bend * a;
  const joint = add(root, scale(dir(upper), l1));
  const end = add(root, scale(dir(base), d));
  return { joint, end };
}
