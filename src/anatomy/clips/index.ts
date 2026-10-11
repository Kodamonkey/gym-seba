import type { Clip } from '../clip';
import { abCrunchMachine, cableCrunch, pallofHold, pallofPress } from './core';
import { cableCurl, dbCurl, tricepsExtensionMachine, tricepsPushdown } from './arms';
import { chestPressMachine } from './chest-press-machine';
import { cableReverseFly, reversePecDeck } from './fly';
import { dbSplitSquat, hipThrustMachine, smithHipThrust, smithSplitSquat } from './glutes';
import { cableLateralRaise, dbLateralRaise } from './lateral-raise';
import {
  bbRdl,
  dbCalfRaise,
  dbRdl,
  gobletSquat,
  legExtension,
  legPress,
  lyingLegCurl,
  seatedLegCurl,
  smithCalfRaise,
  smithSquat,
  standingCalfMachine,
} from './legs';
import { dbBenchPress, dbSeatedShoulderPress, inclineDbPress, inclinePressMachine, shoulderPressMachine } from './press';
import { chestSupportedRow, latPulldownNeutral, latPulldownSupine, latPulldownWide, seatedCableRow, seatedRowMachine } from './pull';

/** Registro de clips anatómicos por id de variante. */
const ALL: Clip[] = [
  chestPressMachine,
  dbBenchPress,
  inclineDbPress,
  inclinePressMachine,
  latPulldownWide,
  latPulldownSupine,
  latPulldownNeutral,
  seatedRowMachine,
  seatedCableRow,
  chestSupportedRow,
  shoulderPressMachine,
  dbSeatedShoulderPress,
  dbLateralRaise,
  cableLateralRaise,
  reversePecDeck,
  cableReverseFly,
  tricepsPushdown,
  tricepsExtensionMachine,
  cableCurl,
  dbCurl,
  legPress,
  gobletSquat,
  smithSquat,
  dbRdl,
  bbRdl,
  lyingLegCurl,
  seatedLegCurl,
  legExtension,
  standingCalfMachine,
  dbCalfRaise,
  smithCalfRaise,
  hipThrustMachine,
  smithHipThrust,
  dbSplitSquat,
  smithSplitSquat,
  pallofPress,
  pallofHold,
  cableCrunch,
  abCrunchMachine,
];

export const CLIPS: ReadonlyMap<string, Clip> = new Map(ALL.map((c) => [c.id, c]));

export function clipFor(clipId: string | null | undefined): Clip | undefined {
  return clipId ? CLIPS.get(clipId) : undefined;
}
