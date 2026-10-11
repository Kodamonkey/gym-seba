import type { ShapeTpl, View } from '../rig';
import { FRONT_SHAPES } from './front';
import { REAR_SHAPES } from './rear';
import { SIDE_SHAPES } from './side';

export const BODY_SHAPES: Record<View, readonly ShapeTpl[]> = {
  side: SIDE_SHAPES,
  front: FRONT_SHAPES,
  rear: REAR_SHAPES,
};
