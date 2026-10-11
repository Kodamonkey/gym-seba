import { AnatomyPlayer, Scene, useRoleMap } from '../../anatomy/AnatomyPlayer';
import { CLIPS } from '../../anatomy/clips';
import { MUSCLE_BY_ID } from '../../data/seed/muscles';
import { VARIANT_BY_ID } from '../../data/seed/catalog';

const regionsOf = (id: string) => MUSCLE_BY_ID.get(id)?.regions ?? [];

function Item({ id, frames, vb }: { id: string; frames?: number[]; vb?: [number, number, number, number] }) {
  const base = CLIPS.get(id)!;
  const clip = vb ? { ...base, viewBox: vb } : base;
  const variant = VARIANT_BY_ID.get(id);
  const roles = useRoleMap(variant?.muscles ?? [], regionsOf);
  if (frames) {
    return (
      <div className="grid grid-cols-2 gap-2" data-testid="frames">
        {frames.map((t) => (
          <div key={t} className="aspect-[16/12] rounded border border-line">
            <Scene clip={clip} roles={roles} t={t} stab={true} title={`${id} t=${t}`} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <section className="rounded-xl bg-surface p-2">
      <h2 className="px-2 py-1 font-semibold">{variant?.name ?? id}</h2>
      <AnatomyPlayer clip={clip} roles={roles} hasStabilizers={!!variant?.muscles.some((m) => m.role === 'stabilizer')} label={variant?.name ?? id} />
    </section>
  );
}

/** Galería de todas las demostraciones (revisión visual). */
export function DemoGallery() {
  const params = new URLSearchParams(location.search);
  const only = params.get('only');
  const ids = only ? [only] : [...CLIPS.keys()];
  const framesParam = params.get('frames');
  const frames = framesParam ? framesParam.split(',').map(Number) : undefined;
  const vbParam = params.get('vb');
  const vb = vbParam ? (vbParam.split(',').map(Number) as [number, number, number, number]) : undefined;
  return (
    <div className={only ? 'p-2' : 'mx-auto grid max-w-5xl gap-4 p-4 md:grid-cols-2'}>
      {ids.map((id) => (
        <Item key={id} id={id} {...(frames ? { frames } : {})} {...(vb ? { vb } : {})} />
      ))}
    </div>
  );
}
