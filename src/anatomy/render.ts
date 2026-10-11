import { BODY_SHAPES } from './body';
import type { Clip, Prim } from './clip';
import { resolveShapes, solveRig } from './rig';
import type { MuscleRole } from '../domain/types';

export type RoleMap = ReadonlyMap<string, MuscleRole>;

const ROLE_CLASS: Record<MuscleRole, string> = { target: 'r-target', synergist: 'r-syn', stabilizer: 'r-stab' };

/** Calcula todas las primitivas (cuerpo + equipo) de un fotograma. */
export function buildFrame(clip: Clip, t: number, roles: RoleMap): Prim[] {
  const pose = clip.pose(t);
  const rig = solveRig(clip.view, pose);
  const shapes = resolveShapes(rig, BODY_SHAPES[clip.view]);
  const ghost = new Set(clip.ghost ?? []);
  const prims: Prim[] = shapes.map((s) => {
    const inactive = !!clip.activeSides && s.side !== null && s.group !== 'trunk' && !clip.activeSides.includes(s.side);
    const role = s.region && !inactive ? roles.get(s.region) : undefined;
    const isGhost = s.side === 'near' && s.group !== 'trunk' && ghost.has(s.group);
    const cls = [
      s.kind === 'skin' ? 'sk' : s.kind === 'muscle' ? 'mu' : 'dt',
      s.side === 'far' ? 'far' : '',
      isGhost ? 'ghost' : '',
      role ? ROLE_CLASS[role] : '',
    ]
      .filter(Boolean)
      .join(' ');
    return { key: s.key, layer: s.layer, d: s.d, cls };
  });
  prims.push(...clip.equipment(rig, t));
  return prims;
}

/** Regiones dibujadas en una vista (para indicar músculos no visibles). */
export function regionsInView(view: Clip['view']): Set<string> {
  return new Set(BODY_SHAPES[view].map((s) => s.region).filter((r): r is string => !!r));
}

/**
 * Escena SVG imperativa: crea los paths una vez y solo actualiza `d` en cada fotograma,
 * sin re-renderizar React a 60 fps.
 */
export class SvgStage {
  private readonly els = new Map<string, SVGPathElement>();
  private order = '';

  constructor(private readonly root: SVGGElement) {}

  update(prims: Prim[]): void {
    const sorted = [...prims].sort((a, b) => a.layer - b.layer);
    const order = sorted.map((p) => p.key).join('|');
    for (const p of sorted) {
      let el = this.els.get(p.key);
      if (!el) {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this.els.set(p.key, el);
      }
      if (el.getAttribute('class') !== p.cls) el.setAttribute('class', p.cls);
      el.setAttribute('d', p.d);
    }
    if (order !== this.order) {
      const keep = new Set(sorted.map((p) => p.key));
      for (const [key, el] of this.els) {
        if (!keep.has(key)) {
          el.remove();
          this.els.delete(key);
        }
      }
      for (const p of sorted) this.root.appendChild(this.els.get(p.key)!);
      this.order = order;
    }
  }

  clear(): void {
    for (const el of this.els.values()) el.remove();
    this.els.clear();
    this.order = '';
  }
}

/** SVG estático (póster) como string, para miniaturas sin animación. */
export function framePaths(clip: Clip, t: number, roles: RoleMap): Prim[] {
  return buildFrame(clip, t, roles).sort((a, b) => a.layer - b.layer);
}
