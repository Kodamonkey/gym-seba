import { add, angleOf, dir, fromUp, ik2, scale, smoothClosed, sub, DEG, type Vec } from './geom';

/**
 * Rig anatómico 2D. Proporciones genéricas plausibles de un adulto (~177 cm);
 * no se derivan de la estatura ni del peso del usuario.
 *
 * Cada forma (silueta o músculo) es una lista de anclas `[segmento, u, v]`:
 *   u = fracción a lo largo del segmento (0 = articulación de origen, 1 = extremo),
 *   v = desplazamiento perpendicular en cm (anterior + en vista lateral; lateral + en vistas frontal/posterior).
 * Las anclas se resuelven cada fotograma con la pose del esqueleto, así que un músculo
 * que cruza una articulación (pectoral → húmero, glúteo → fémur) se deforma con ella
 * y el resaltado nunca se separa del cuerpo.
 */

export type View = 'side' | 'front' | 'rear';
export type Side = 'near' | 'far' | 'L' | 'R';
export type SegName = 'abdomen' | 'chest' | 'head' | 'upperArm' | 'forearm' | 'hand' | 'thigh' | 'shank' | 'foot';
export type LimbKind = 'arm' | 'leg';

export const DIM = {
  abdomen: 22,
  chest: 28,
  head: 31,
  upperArm: 30,
  forearm: 26,
  hand: 18,
  /** De la muñeca al centro del agarre. */
  grip: 7.5,
  thigh: 44,
  shank: 43,
  foot: 20,
  ankleHeight: 8,
  shoulderSide: { u: 0.86, v: 1 },
  shoulderFront: { u: 0.84, v: 19.5 },
  hipFront: 9,
} as const;

export interface LimbPose {
  /** Objetivo IK: punto de agarre (brazos) o tobillo (piernas). */
  ik?: Vec;
  bend?: 1 | -1;
  /** Ángulos absolutos (grados, 0 = +x, 90 = abajo) del segmento proximal y distal. */
  fk?: [number, number];
  /** Ángulo absoluto de la mano / pie. */
  end?: number;
  /** Escorzo (0–1) del segmento proximal y distal, para movimientos fuera del plano de la vista. */
  scale?: number;
  scale2?: number;
}

export interface Pose {
  /** Vista lateral: centro de la cadera. Vistas frontal/posterior: centro de la pelvis a la altura de las caderas. */
  pelvis: Vec;
  /** Inclinación del abdomen desde la vertical (grados; + hacia +x). */
  abdomen: number;
  /** Flexión del tórax respecto del abdomen (grados; + = flexión hacia delante en vista lateral). */
  spine?: number;
  neck?: number;
  limbs: Partial<Record<`${LimbKind}${Capitalize<Side>}`, LimbPose>>;
}

export interface Seg {
  o: Vec;
  a: number;
  len: number;
  scale: number;
  mirror: 1 | -1;
}

export type SegKey = SegName | `${Exclude<SegName, 'abdomen' | 'chest' | 'head'>}.${Side}`;

export interface Rig {
  view: View;
  segs: Map<string, Seg>;
  sides: Side[];
}

export function sidesOf(view: View): Side[] {
  return view === 'side' ? ['far', 'near'] : ['L', 'R'];
}

const cap = (s: Side) => (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<Side>;

export function pointOn(seg: Seg, u: number, vv: number): Vec {
  const axis = dir(seg.a);
  const nrm = { x: -axis.y, y: axis.x };
  return add(seg.o, add(scale(axis, u * seg.len * seg.scale), scale(nrm, vv * seg.mirror)));
}

export function segEnd(seg: Seg): Vec {
  return pointOn(seg, 1, 0);
}

/** Signo para anclas del tronco en formas instanciadas por lado (vistas frontal/posterior). */
export function trunkSign(view: View, side: Side): 1 | -1 {
  if (view === 'front') return side === 'L' ? 1 : -1;
  if (view === 'rear') return side === 'L' ? -1 : 1;
  return 1;
}

function limbMirror(view: View, side: Side, seg: SegName): 1 | -1 {
  if (view === 'side') return seg === 'foot' ? 1 : -1;
  if (view === 'front') return side === 'L' ? -1 : 1;
  return side === 'L' ? 1 : -1;
}

export function solveRig(view: View, pose: Pose): Rig {
  const segs = new Map<string, Seg>();
  const abdomen: Seg = { o: pose.pelvis, a: fromUp(pose.abdomen), len: DIM.abdomen, scale: 1, mirror: 1 };
  segs.set('abdomen', abdomen);
  const chest: Seg = { o: segEnd(abdomen), a: fromUp(pose.abdomen + (pose.spine ?? 0)), len: DIM.chest, scale: 1, mirror: 1 };
  segs.set('chest', chest);
  const head: Seg = {
    o: segEnd(chest),
    a: fromUp(pose.abdomen + (pose.spine ?? 0) + (pose.neck ?? 0)),
    len: DIM.head,
    scale: 1,
    mirror: 1,
  };
  segs.set('head', head);

  for (const side of sidesOf(view)) {
    const ts = trunkSign(view, side);
    // Brazo
    const shoulder =
      view === 'side'
        ? pointOn(chest, DIM.shoulderSide.u, DIM.shoulderSide.v)
        : pointOn(chest, DIM.shoulderFront.u, DIM.shoulderFront.v * ts);
    const arm = pose.limbs[`arm${cap(side)}`] ?? { fk: [90, 90] };
    solveLimb(segs, view, side, 'arm', shoulder, arm);
    // Pierna
    const hip = view === 'side' ? pose.pelvis : pointOn(abdomen, 0, DIM.hipFront * ts);
    const leg = pose.limbs[`leg${cap(side)}`] ?? { fk: [90, 90] };
    solveLimb(segs, view, side, 'leg', hip, leg);
  }
  return { view, segs, sides: sidesOf(view) };
}

function solveLimb(segs: Map<string, Seg>, view: View, side: Side, kind: LimbKind, root: Vec, p: LimbPose) {
  const [n1, n2, n3] = kind === 'arm' ? (['upperArm', 'forearm', 'hand'] as const) : (['thigh', 'shank', 'foot'] as const);
  const s1 = p.scale ?? 1;
  const s2 = p.scale2 ?? s1;
  const l1 = DIM[n1];
  const l2 = DIM[n2];
  let a1: number;
  let a2: number;
  let a3: number;
  if (p.ik) {
    let target = p.ik;
    let reach2 = l2 * s2;
    if (kind === 'arm') {
      if (p.end !== undefined) target = sub(p.ik, scale(dir(p.end * DEG), DIM.grip * s2));
      else reach2 = (l2 + DIM.grip) * s2;
    }
    const { joint, end } = ik2(root, target, l1 * s1, reach2, p.bend ?? 1);
    a1 = angleOf(sub(joint, root));
    a2 = angleOf(sub(end, joint));
    a3 = p.end !== undefined ? p.end * DEG : kind === 'arm' ? a2 : view === 'side' ? 0 : Math.PI / 2;
  } else {
    const [f1, f2] = p.fk ?? [90, 90];
    a1 = f1 * DEG;
    a2 = f2 * DEG;
    a3 = p.end !== undefined ? p.end * DEG : kind === 'arm' ? a2 : view === 'side' ? 0 : Math.PI / 2;
  }
  const seg1: Seg = { o: root, a: a1, len: l1, scale: s1, mirror: limbMirror(view, side, n1) };
  const seg2: Seg = { o: segEnd(seg1), a: a2, len: l2, scale: s2, mirror: limbMirror(view, side, n2) };
  const footLen = kind === 'leg' && view !== 'side' ? DIM.ankleHeight + 2 : DIM[n3];
  const seg3: Seg = { o: segEnd(seg2), a: a3, len: footLen, scale: kind === 'arm' ? s2 : 1, mirror: limbMirror(view, side, n3) };
  segs.set(`${n1}.${side}`, seg1);
  segs.set(`${n2}.${side}`, seg2);
  segs.set(`${n3}.${side}`, seg3);
}

/* ---------- Puntos útiles para el equipo ---------- */

/** Centro del agarre de la mano. */
export function gripPoint(rig: Rig, side: Side): Vec {
  return pointOn(rig.segs.get(`hand.${side}`)!, DIM.grip / DIM.hand, 0);
}

export function jointPoint(rig: Rig, seg: string, u = 0): Vec {
  return pointOn(rig.segs.get(seg)!, u, 0);
}

/** Tobillo a partir de un punto del pie (en coordenadas locales del pie, vista lateral) y su ángulo. */
export function ankleFrom(local: Vec, at: Vec, footDeg: number): Vec {
  const r = footDeg * DEG;
  const off = { x: local.x * Math.cos(r) - local.y * Math.sin(r), y: local.x * Math.sin(r) + local.y * Math.cos(r) };
  return sub(at, off);
}

/** Puntos del pie en vista lateral (relativos al tobillo, eje hacia la punta, y hacia abajo). */
export const FOOT = {
  heel: { x: -5, y: DIM.ankleHeight },
  ball: { x: 14, y: DIM.ankleHeight },
  toe: { x: 19.5, y: DIM.ankleHeight - 1 },
};

/* ---------- Formas ---------- */

export type Anchor = readonly [SegName, number, number];

export type ShapeKind = 'skin' | 'muscle' | 'detail';
export type ShapeGroup = 'trunk' | 'arm' | 'leg';

export interface ShapeTpl {
  id: string;
  /** Región muscular (ver src/data/seed/muscles.ts). */
  region?: string;
  kind: ShapeKind;
  group: ShapeGroup;
  /** 'single': una vez (tronco/cabeza). 'perSide': por cada lado. */
  per: 'single' | 'perSide';
  anchors: readonly Anchor[];
  tension?: number;
}

export interface ResolvedShape {
  key: string;
  region?: string;
  kind: ShapeKind;
  group: ShapeGroup;
  side: Side | null;
  layer: number;
  d: string;
}

const TRUNK: ReadonlySet<SegName> = new Set(['abdomen', 'chest', 'head']);

export const LAYER = {
  back: 0,
  far: 10,
  farArm: 14,
  mid: 20,
  torso: 30,
  nearLeg: 40,
  midFront: 50,
  nearArm: 60,
  front: 70,
} as const;

function layerFor(view: View, group: ShapeGroup, side: Side | null): number {
  if (view === 'side') {
    if (group === 'trunk') return LAYER.torso;
    if (side === 'far') return group === 'arm' ? LAYER.farArm : LAYER.far;
    return group === 'arm' ? LAYER.nearArm : LAYER.nearLeg;
  }
  if (group === 'trunk') return LAYER.torso;
  return group === 'arm' ? LAYER.nearArm : LAYER.nearLeg;
}

export function resolveShapes(rig: Rig, templates: readonly ShapeTpl[]): ResolvedShape[] {
  const out: ResolvedShape[] = [];
  templates.forEach((tpl, index) => {
    const hasTrunk = tpl.anchors.some(([s]) => TRUNK.has(s));
    const hasLimb = tpl.anchors.some(([s]) => !TRUNK.has(s));
    const instances: (Side | null)[] =
      tpl.per === 'single'
        ? [null]
        : rig.view === 'side'
          ? hasTrunk
            ? ['near']
            : ['far', 'near']
          : ['L', 'R'];
    for (const side of instances) {
      const pts = tpl.anchors.map(([s, u, vv]) => {
        if (TRUNK.has(s)) {
          const sign = side && rig.view !== 'side' ? trunkSign(rig.view, side) : 1;
          return pointOn(rig.segs.get(s)!, u, vv * sign);
        }
        const seg = rig.segs.get(`${s}.${side ?? 'near'}`);
        return pointOn(seg!, u, vv);
      });
      const group: ShapeGroup = tpl.group;
      const layer = layerFor(rig.view, group, hasLimb ? side : null) + index * 0.001;
      out.push({
        key: `${tpl.id}${side ? '.' + side : ''}`,
        ...(tpl.region ? { region: tpl.region } : {}),
        kind: tpl.kind,
        group: tpl.group,
        side,
        layer,
        d: smoothClosed(pts, tpl.tension ?? 1),
      });
    }
  });
  return out;
}
