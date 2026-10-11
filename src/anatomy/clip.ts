import { lerp } from './geom';
import type { Pose, Rig, Side, View } from './rig';

/** Primitiva de dibujo: un path con clase y capa (cuerpo o equipo). */
export interface Prim {
  key: string;
  layer: number;
  d: string;
  cls: string;
}

export interface ClipPhase {
  from: number;
  to: number;
  label: string;
}

/**
 * Demostración anatómica de una variante concreta. Las fases pertenecen a cada clip:
 * no se asume que todos los ejercicios tengan las mismas etapas ni la misma duración.
 */
export interface Clip {
  id: string;
  view: View;
  viewLabel: string;
  /** x, y, ancho, alto en cm. */
  viewBox: [number, number, number, number];
  floorY: number | null;
  /** Duración de un ciclo a velocidad 1×. */
  seconds: number;
  kind: 'reps' | 'hold';
  phases: ClipPhase[];
  /** Lado que se demuestra en ejercicios unilaterales. */
  sideLabel?: string;
  /** Aclaraciones honestas sobre la representación (p. ej. escorzo, equipo genérico). */
  caption: string;
  /** Extremidades cercanas dibujadas semitransparentes para no tapar el músculo objetivo. */
  ghost?: ('arm' | 'leg')[];
  /** En unilaterales, lados de las extremidades que trabajan (el resto no se resalta). */
  activeSides?: Side[];
  pose(t: number): Pose;
  equipment(rig: Rig, t: number): Prim[];
}

export interface RepTiming {
  /** Pausa inicial, fase concéntrica, pausa, retorno. Suman ≤ 1; el resto es pausa final. */
  hold0: number;
  up: number;
  hold1: number;
  down: number;
}

export const DEFAULT_TIMING: RepTiming = { hold0: 0.08, up: 0.34, hold1: 0.1, down: 0.42 };

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);

/** Progreso 0 → 1 → 0 de una repetición con pausas y retorno más lento. */
export function repProgress(t: number, timing: RepTiming = DEFAULT_TIMING): number {
  const x = ((t % 1) + 1) % 1;
  const a = timing.hold0;
  const b = a + timing.up;
  const c = b + timing.hold1;
  const d = c + timing.down;
  if (x < a) return 0;
  if (x < b) return ease((x - a) / timing.up);
  if (x < c) return 1;
  if (x < d) return 1 - ease((x - c) / timing.down);
  return 0;
}

export function repPhases(labels: [string, string, string, string], timing: RepTiming = DEFAULT_TIMING): ClipPhase[] {
  const a = timing.hold0;
  const b = a + timing.up;
  const c = b + timing.hold1;
  const d = c + timing.down;
  return [
    { from: 0, to: a, label: labels[0] },
    { from: a, to: b, label: labels[1] },
    { from: b, to: c, label: labels[2] },
    { from: c, to: d, label: labels[3] },
    { from: d, to: 1, label: labels[0] },
  ];
}

export function phaseAt(phases: ClipPhase[], t: number): ClipPhase | undefined {
  const x = ((t % 1) + 1) % 1;
  return phases.find((p) => x >= p.from && x < p.to) ?? phases[phases.length - 1];
}

/** Interpolación entre dos valores según el progreso. */
export const mix = (a: number, b: number, p: number) => lerp(a, b, p);
