import type { ShapeTpl } from '../rig';

/**
 * Siluetas de extremidades compartidas por las vistas frontal y posterior.
 * v > 0 = lateral (hacia fuera del cuerpo), v < 0 = medial.
 */
export const CORONAL_LIMB_SKIN: readonly ShapeTpl[] = [
  {
    id: 'thigh',
    kind: 'skin',
    group: 'leg',
    per: 'perSide',
    anchors: [
      ['thigh', -0.14, 8.6],
      ['thigh', 0.2, 9.2],
      ['thigh', 0.6, 7.6],
      ['thigh', 0.95, 5.6],
      ['thigh', 1.06, 5],
      ['thigh', 1.06, -4.8],
      ['thigh', 0.7, -5.6],
      ['thigh', 0.3, -7.6],
      ['thigh', 0.02, -9],
      ['thigh', -0.1, -6],
    ],
  },
  {
    id: 'shank',
    kind: 'skin',
    group: 'leg',
    per: 'perSide',
    anchors: [
      ['shank', -0.03, 5.2],
      ['shank', 0.25, 5.5],
      ['shank', 0.6, 4],
      ['shank', 0.95, 2.8],
      ['shank', 1.02, 2.6],
      ['shank', 1.02, -2.6],
      ['shank', 0.6, -3.4],
      ['shank', 0.25, -4.8],
      ['shank', -0.03, -4.9],
    ],
  },
  {
    id: 'foot',
    kind: 'skin',
    group: 'leg',
    per: 'perSide',
    tension: 0.8,
    anchors: [
      ['foot', -0.1, 3.2],
      ['foot', 0.45, 4.2],
      ['foot', 0.98, 4.6],
      ['foot', 1.0, -4.2],
      ['foot', 0.45, -3.6],
      ['foot', -0.1, -3],
    ],
  },
  {
    id: 'upperArm',
    kind: 'skin',
    group: 'arm',
    per: 'perSide',
    anchors: [
      ['upperArm', -0.1, 4.6],
      ['upperArm', 0.25, 5.2],
      ['upperArm', 0.6, 4.5],
      ['upperArm', 1.0, 3.9],
      ['upperArm', 1.08, 0],
      ['upperArm', 1.02, -3.6],
      ['upperArm', 0.6, -4.1],
      ['upperArm', 0.25, -4.3],
      ['upperArm', -0.04, -3.6],
    ],
  },
  {
    id: 'forearm',
    kind: 'skin',
    group: 'arm',
    per: 'perSide',
    anchors: [
      ['forearm', -0.04, 4.1],
      ['forearm', 0.25, 4.5],
      ['forearm', 0.7, 3.2],
      ['forearm', 1.0, 2.6],
      ['forearm', 1.02, -2.6],
      ['forearm', 0.6, -3],
      ['forearm', 0.2, -3.6],
      ['forearm', -0.05, -3.6],
    ],
  },
  {
    id: 'hand',
    kind: 'skin',
    group: 'arm',
    per: 'perSide',
    tension: 0.9,
    anchors: [
      ['hand', -0.02, 2.6],
      ['hand', 0.3, 3.1],
      ['hand', 0.58, 2.6],
      ['hand', 0.64, 0],
      ['hand', 0.58, -2.6],
      ['hand', 0.3, -3],
      ['hand', -0.02, -2.5],
    ],
  },
];

/** Contorno del tronco (frontal y posterior son simétricos). */
export const CORONAL_TORSO: ShapeTpl = {
  id: 'torso',
  kind: 'skin',
  group: 'trunk',
  per: 'single',
  anchors: [
    ['abdomen', -0.3, 0],
    ['abdomen', -0.12, 14.8],
    ['abdomen', 0.3, 15.4],
    ['abdomen', 0.88, 13.6],
    ['chest', 0.25, 14.8],
    ['chest', 0.55, 17],
    ['chest', 0.78, 18.4],
    ['chest', 0.9, 20.8],
    ['chest', 0.97, 15],
    ['chest', 1.02, 6.6],
    ['chest', 1.02, -6.6],
    ['chest', 0.97, -15],
    ['chest', 0.9, -20.8],
    ['chest', 0.78, -18.4],
    ['chest', 0.55, -17],
    ['chest', 0.25, -14.8],
    ['abdomen', 0.88, -13.6],
    ['abdomen', 0.3, -15.4],
    ['abdomen', -0.12, -14.8],
  ],
};

export function coronalHead(face: boolean): ShapeTpl[] {
  return [
    {
      id: 'head',
      kind: 'skin',
      group: 'trunk',
      per: 'single',
      anchors: [
        ['head', -0.02, 5.8],
        ['head', 0.27, 5.2],
        ['head', 0.4, face ? 6.2 : 7],
        ['head', 0.55, 8.3],
        ['head', 0.75, 8.6],
        ['head', 0.92, 6.6],
        ['head', 1.0, 0],
        ['head', 0.92, -6.6],
        ['head', 0.75, -8.6],
        ['head', 0.55, -8.3],
        ['head', 0.4, face ? -6.2 : -7],
        ['head', 0.27, -5.2],
        ['head', -0.02, -5.8],
      ],
    },
    {
      id: 'ear',
      kind: 'detail',
      group: 'trunk',
      per: 'perSide',
      anchors: [
        ['head', 0.52, 8.2],
        ['head', 0.66, 9.4],
        ['head', 0.68, 8.4],
      ],
    },
  ];
}
