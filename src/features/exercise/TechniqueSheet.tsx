import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../data/db';
import { Dialog } from '../../ui/primitives';
import { DemoBlock } from './DemoBlock';
import { MuscleInfo, TechniqueInfo } from './MuscleInfo';

/** Hoja con la demostración, la técnica y los músculos de una variante. */
export function TechniqueSheet({ variantId, onClose }: { variantId: string | null; onClose: () => void }) {
  const variant = useLiveQuery(async () => (variantId ? ((await db.variants.get(variantId)) ?? null) : null), [variantId]);
  return (
    <Dialog open={!!variantId} onClose={onClose} title={variant?.name ?? 'Técnica'}>
      {variant && (
        <div className="flex flex-col gap-5">
          <DemoBlock variant={variant} compact />
          <TechniqueInfo variant={variant} />
          <MuscleInfo variant={variant} />
        </div>
      )}
    </Dialog>
  );
}
