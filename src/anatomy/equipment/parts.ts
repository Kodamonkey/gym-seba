import type { Prim } from '../clip';
import { add, bar, circle, dist, lerpV, orientedRect, polyline, rotate, sub, v, type Vec, angleOf } from '../geom';
import { LAYER } from '../rig';

/**
 * Piezas de equipo reutilizables. Todas devuelven primitivas con capa explícita
 * para que el cuerpo quede delante o detrás de forma coherente.
 */

export const L = LAYER;

export function floor(y: number, x0 = -200, x1 = 400): Prim {
  return { key: 'floor', layer: L.back - 1, d: orientedRect(v((x0 + x1) / 2, y + 3), x1 - x0, 6), cls: 'eq-floor' };
}

export function rect(key: string, layer: number, center: Vec, w: number, h: number, rad = 0, cls = 'eq-frame', r = 0): Prim {
  return { key, layer, d: orientedRect(center, w, h, rad, r), cls };
}

export function beam(key: string, layer: number, a: Vec, b: Vec, thickness: number, cls = 'eq-frame', r = 0): Prim {
  return { key, layer, d: bar(a, b, thickness, r), cls };
}

export function disc(key: string, layer: number, c: Vec, r: number, cls = 'eq-plate'): Prim {
  return { key, layer, d: circle(c, r), cls };
}

export function cable(key: string, layer: number, points: Vec[]): Prim {
  return { key, layer, d: polyline(points), cls: 'eq-cable' };
}

/** Almohadilla con bordes redondeados entre dos puntos. */
export function pad(key: string, layer: number, a: Vec, b: Vec, thickness: number): Prim {
  return { key, layer, d: bar(a, b, thickness, thickness / 2.2), cls: 'eq-pad' };
}

/** Mancuerna vista de canto (eje del agarre hacia la profundidad): disco con aro. */
export function dumbbellEnd(key: string, layer: number, c: Vec, r = 8): Prim[] {
  return [
    { key: `${key}.plate`, layer, d: circle(c, r), cls: 'eq-plate' },
    { key: `${key}.hub`, layer: layer + 0.01, d: circle(c, r * 0.35), cls: 'eq-metal' },
  ];
}

/** Mancuerna de perfil (eje del agarre en el plano de la vista). */
export function dumbbellProfile(key: string, layer: number, c: Vec, rad: number, handle = 14, plateW = 6, plateH = 15): Prim[] {
  const axis = { x: Math.cos(rad), y: Math.sin(rad) };
  const half = handle / 2 + plateW / 2;
  return [
    { key: `${key}.handle`, layer, d: bar(add(c, { x: -axis.x * half, y: -axis.y * half }), add(c, { x: axis.x * half, y: axis.y * half }), 3, 1.4), cls: 'eq-metal' },
    { key: `${key}.p1`, layer: layer + 0.01, d: orientedRect(add(c, { x: -axis.x * half, y: -axis.y * half }), plateW, plateH, rad, 2), cls: 'eq-plate' },
    { key: `${key}.p2`, layer: layer + 0.01, d: orientedRect(add(c, { x: axis.x * half, y: axis.y * half }), plateW, plateH, rad, 2), cls: 'eq-plate' },
  ];
}

/** Barra vista de canto: disco grande y manga. */
export function barbellEnd(key: string, layer: number, c: Vec, r = 22.5): Prim[] {
  return [
    { key: `${key}.plate`, layer, d: circle(c, r), cls: 'eq-plate' },
    { key: `${key}.plate2`, layer: layer + 0.01, d: circle(c, r * 0.72), cls: 'eq-plate-inner' },
    { key: `${key}.sleeve`, layer: layer + 0.02, d: circle(c, 2.6), cls: 'eq-metal' },
  ];
}

export function pulley(key: string, layer: number, c: Vec, r = 4): Prim[] {
  return [
    { key: `${key}.wheel`, layer, d: circle(c, r), cls: 'eq-metal' },
    { key: `${key}.axle`, layer: layer + 0.01, d: circle(c, r * 0.35), cls: 'eq-frame' },
  ];
}

/**
 * Columna con pila de pesas. `lift` (cm) es cuánto sube el bloque seleccionado:
 * se deriva del desplazamiento del cable o palanca, no se anima por separado.
 */
export function weightStack(key: string, layer: number, base: Vec, lift: number, height = 140, plates = 6): Prim[] {
  const w = 22;
  const plateH = 4.2;
  const out: Prim[] = [
    { key: `${key}.railL`, layer, d: bar(v(base.x - w / 2 - 2, base.y), v(base.x - w / 2 - 2, base.y - height), 2.4), cls: 'eq-frame' },
    { key: `${key}.railR`, layer, d: bar(v(base.x + w / 2 + 2, base.y), v(base.x + w / 2 + 2, base.y - height), 2.4), cls: 'eq-frame' },
    { key: `${key}.top`, layer, d: orientedRect(v(base.x, base.y - height), w + 10, 5, 0, 1.5), cls: 'eq-frame' },
  ];
  const lifted = Math.max(0, lift);
  for (let i = 0; i < plates; i++) {
    const moving = i >= plates - 3;
    const y = base.y - 2 - i * (plateH + 0.6) - (moving ? lifted : 0);
    out.push({ key: `${key}.plate${i}`, layer: layer + 0.01, d: orientedRect(v(base.x, y), w, plateH, 0, 0.8), cls: moving ? 'eq-stack-live' : 'eq-stack' });
  }
  const topMoving = base.y - 2 - (plates - 1) * (plateH + 0.6) - lifted;
  out.push({ key: `${key}.rod`, layer: layer + 0.02, d: bar(v(base.x, topMoving - 2), v(base.x, base.y - height + 4), 1.2), cls: 'eq-metal' });
  return out;
}

/** Cable que pasa por varias poleas: devuelve el largo total (para derivar la pila). */
export function cablePath(points: Vec[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1]!, points[i]!);
  return total;
}

/** Agarre/manija simple centrado en el punto de agarre. */
export function handle(key: string, layer: number, c: Vec, rad: number, length = 12): Prim {
  const axis = { x: Math.cos(rad) * (length / 2), y: Math.sin(rad) * (length / 2) };
  return { key, layer, d: bar(sub(c, axis), add(c, axis), 3, 1.5), cls: 'eq-metal' };
}

/** Barra/brazo de palanca entre un pivote y un punto, con el pivote marcado. */
export function lever(key: string, layer: number, pivot: Vec, end: Vec, thickness = 4): Prim[] {
  return [
    { key: `${key}.arm`, layer, d: bar(pivot, end, thickness, thickness / 2), cls: 'eq-frame' },
    { key: `${key}.pivot`, layer: layer + 0.01, d: circle(pivot, thickness * 0.9), cls: 'eq-metal' },
  ];
}

export { add, sub, v, lerpV, rotate, angleOf, dist };
