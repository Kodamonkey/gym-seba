import { comparisonKeyOf, LB_TO_KG } from '../../domain/load';
import type { LoadUnit, SessionExercise, SetLog } from '../../domain/types';
import { db } from '../../data/db';
import { previousComparable } from '../../data/sessions';

export interface Suggestion {
  load: number | null;
  reps: number | null;
  durationSec: number | null;
  source: 'previous' | 'progression';
  fromDate: string;
}

function loadInUnit(load: number | null, from: LoadUnit, to: LoadUnit): number | null {
  if (load === null || from === to) return load;
  const converted = to === 'kg' ? load * LB_TO_KG : load / LB_TO_KG;
  return Math.round(converted * 1000) / 1000;
}

/** Sugerencias (no son resultados): último registro comparable o una progresión aceptada. */
export async function suggestionsFor(se: SessionExercise): Promise<{ prev: Awaited<ReturnType<typeof previousComparable>>; byOrder: Map<number, Suggestion> }> {
  const prev = await previousComparable(se);
  const byOrder = new Map<number, Suggestion>();
  if (prev && prev.sessionExercise.unilateralLogging === se.unilateralLogging) {
    const work = prev.sets.filter((s) => s.kind === 'work');
    work.forEach((s, i) => byOrder.set(i, { load: loadInUnit(s.load, s.unit, se.unit), reps: s.reps, durationSec: s.durationSec, source: 'previous', fromDate: prev.session.localDate }));
  }
  const key = comparisonKeyOf(se).key;
  const decisions = await db.progressionDecisions.where('comparisonKey').equals(key).toArray();
  const accepted = decisions
    .filter((d) => d.decision === 'accepted' || d.decision === 'adjusted')
    .filter((d) => d.sessionId !== se.sessionId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (accepted && accepted.toLoad !== null && (!prev || accepted.createdAt >= prev.session.startedAt)) {
    const perSideRows = se.variant.laterality === 'unilateral' && se.unilateralLogging === 'per-side-rows';
    const expectedRows = se.prescribed.sets * (perSideRows ? 2 : 1);
    for (let i = 0; i < Math.max(expectedRows, byOrder.size); i++) {
      const cur = byOrder.get(i);
      byOrder.set(i, { load: loadInUnit(accepted.toLoad, accepted.unit, se.unit), reps: cur?.reps ?? null, durationSec: cur?.durationSec ?? null, source: 'progression', fromDate: accepted.createdAt.slice(0, 10) });
    }
  }
  return { prev, byOrder };
}

/** Descanso tras confirmar: en filas por lado, sin descanso entre lados salvo que se configure. */
export function restAfter(set: SetLog, se: SessionExercise): number {
  if (set.kind !== 'work') return 0;
  if (se.variant.laterality === 'unilateral' && se.unilateralLogging === 'per-side-rows' && set.side === 'left' && !se.restBetweenSides) return 0;
  return se.prescribed.restSec;
}
