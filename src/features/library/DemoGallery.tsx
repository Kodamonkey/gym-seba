import { Link, useSearchParams } from 'react-router';
import { AnatomyPlayer, Scene, useRoleMap } from '../../anatomy/AnatomyPlayer';
import { CLIPS } from '../../anatomy/clips';
import { usePrefersReducedMotion } from '../../app/hooks';
import { MUSCLE_BY_ID } from '../../data/seed/muscles';
import { VARIANT_BY_ID } from '../../data/seed/catalog';
import { EmptyState } from '../../ui/primitives';

const regionsOf = (id: string) => MUSCLE_BY_ID.get(id)?.regions ?? [];

function Item({ id, frames, vb }: { id: string; frames?: number[] | undefined; vb?: [number, number, number, number] | undefined }) {
  const base = CLIPS.get(id)!;
  const clip = vb ? { ...base, viewBox: vb } : base;
  const variant = VARIANT_BY_ID.get(id);
  const roles = useRoleMap(variant?.muscles ?? [], regionsOf);
  const reduced = usePrefersReducedMotion();
  if (frames) {
    // Modo de revisión: fotogramas fijos con la capa de estabilizadores visible.
    return (
      <div className="grid grid-cols-2 gap-2" data-testid="frames">
        {frames.map((t) => (
          <div key={t} className="aspect-[16/12] rounded border border-line">
            <Scene clip={clip} roles={roles} t={t} stab={true} title={`${variant?.name ?? id}, instante ${t}`} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <section className="rounded-xl bg-surface p-2">
      <h2 className="px-2 py-1 font-semibold">
        <Link to={`/biblioteca/${id}`} className="underline-offset-2 hover:underline">
          {variant?.name ?? id}
        </Link>
      </h2>
      <AnatomyPlayer clip={clip} roles={roles} hasStabilizers={!!variant?.muscles.some((m) => m.role === 'stabilizer')} label={variant?.name ?? id} reducedMotion={reduced} compact />
    </section>
  );
}

/**
 * Galería de todas las demostraciones. Parámetros de revisión visual:
 * `?only=<variantId>&frames=0,0.47&vb=x,y,w,h`.
 */
export function DemoGallery() {
  const [params] = useSearchParams();
  const only = params.get('only');
  if (only && !CLIPS.has(only)) return <EmptyState title="Demostración no encontrada" action={<Link to="/demos" className="text-accent underline">Ver todas</Link>} />;
  const ids = only ? [only] : [...CLIPS.keys()];
  const frames = params.get('frames')?.split(',').map(Number);
  const vbParts = params.get('vb')?.split(',').map(Number);
  const vb = vbParts?.length === 4 && vbParts.every(Number.isFinite) ? (vbParts as [number, number, number, number]) : undefined;
  return (
    <div className="flex flex-col gap-4">
      {!only && (
        <div>
          <h1 className="text-2xl font-bold">Galería de demostraciones</h1>
          <p className="text-sm text-muted">
            {CLIPS.size} animaciones propias. Representación anatómica orientativa, no medición individual; revisión biomecánica profesional pendiente.
          </p>
        </div>
      )}
      <div className={only ? '' : 'grid gap-4 md:grid-cols-2'}>
        {ids.map((id) => (
          <Item key={id} id={id} frames={frames} vb={vb} />
        ))}
      </div>
    </div>
  );
}
