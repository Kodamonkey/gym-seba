import { describe, expect, it } from 'vitest';
import { VARIANTS } from '../data/seed/catalog';
import { MUSCLE_BY_ID } from '../data/seed/muscles';
import { ROUTINE_TEMPLATE } from '../data/seed/routine';
import { CLIPS } from './clips';
import { manifestEntryFor } from './manifest';
import { buildFrame, regionsInView } from './render';
import { DIM, gripPoint, solveRig } from './rig';
import { dist } from './geom';

describe('cobertura de demostraciones', () => {
  it('toda variante principal y alternativa habilitada tiene clip o estado pendiente explícito', () => {
    const used = new Set(ROUTINE_TEMPLATE.days.flatMap((d) => d.exercises.flatMap((e) => [e.variantId, ...e.alternativeVariantIds])));
    for (const id of used) {
      const v = VARIANTS.find((x) => x.id === id);
      expect(v, `variante ${id}`).toBeDefined();
      const entry = manifestEntryFor(v!);
      expect(entry, `clip para ${id}`).not.toBeNull();
    }
  });

  it('cada clip corresponde a una variante del catálogo (mismo id)', () => {
    for (const id of CLIPS.keys()) expect(VARIANTS.some((v) => v.clipId === id)).toBe(true);
  });

  it('el manifiesto separa derechos, correspondencia y revisión técnica', () => {
    const e = manifestEntryFor(VARIANTS[0]!)!;
    expect(e.rightsReviewStatus).toBe('own-work');
    expect(e.correspondenceStatus).toBe('self-checked');
    expect(e.technicalReviewStatus).toBe('pending');
  });

  it('cada variante muestra al menos un músculo objetivo en la vista de su clip (los no visibles se rotulan en la UI)', () => {
    for (const v of VARIANTS) {
      const clip = CLIPS.get(v.clipId!)!;
      const regions = regionsInView(clip.view);
      const targets = v.muscles.filter((m) => m.role === 'target');
      const visible = targets.filter((t) => MUSCLE_BY_ID.get(t.muscleId)!.regions.some((x) => regions.has(x)));
      expect(visible.length, `${v.id}: objetivo visible en vista ${clip.view}`).toBeGreaterThan(0);
    }
  });
});

describe('integridad geométrica de los clips', () => {
  it('se puede renderizar cada clip en varios instantes sin valores inválidos', () => {
    for (const clip of CLIPS.values()) {
      for (const t of [0, 0.2, 0.47, 0.8]) {
        const prims = buildFrame(clip, t, new Map());
        for (const p of prims) expect(p.d.includes('NaN'), `${clip.id} ${p.key}`).toBe(false);
      }
    }
  });

  it('las manos alcanzan el agarre cuando el clip usa IK (sin desconexión)', () => {
    for (const clip of CLIPS.values()) {
      for (const t of [0, 0.47]) {
        const pose = clip.pose(t);
        const rig = solveRig(clip.view, pose);
        for (const [limb, lp] of Object.entries(pose.limbs)) {
          if (!limb.startsWith('arm') || !lp?.ik || lp.end !== undefined) continue;
          const side = limb.slice(3).toLowerCase() === 'l' ? 'L' : limb.slice(3).toLowerCase() === 'r' ? 'R' : limb.slice(3).toLowerCase();
          const g = gripPoint(rig, side as 'near');
          const reach = (DIM.upperArm * (lp.scale ?? 1) + (DIM.forearm + DIM.grip) * (lp.scale2 ?? lp.scale ?? 1)) * 0.995;
          const shoulder = rig.segs.get(`upperArm.${side}`)!.o;
          if (dist(shoulder, lp.ik) <= reach) {
            expect(dist(g, lp.ik), `${clip.id} ${limb} t=${t}`).toBeLessThan(1.5);
          }
        }
      }
    }
  });
});
