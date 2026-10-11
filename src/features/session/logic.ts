import { comparisonKeyOf, loadContextOf, normalizedLoadKg, setVolumeKg } from '../../domain/load';
import { newRecordsFromConfirm, type PREntry, type PREvent } from '../../domain/pr';
import type { ID, SessionExercise, SetLog } from '../../domain/types';
import { db } from '../../data/db';
import { confirmSet, prEntries, previousComparable, type SetPatch } from '../../data/sessions';

/**
 * Confirma una serie y detecta récords nuevos comparando con el historial previo
 * de la misma clave de comparación. Solo celebra si la comparabilidad está confirmada.
 */
export async function confirmWithRecords(set: SetLog, values: SetPatch, se: SessionExercise): Promise<{ saved: SetLog; records: PREvent[] }> {
  const key = comparisonKeyOf(se);
  const before = set.kind === 'work' ? await prEntries(key.key) : [];
  const saved = await confirmSet(set.id, values, set.rev);
  if (saved.kind !== 'work' || !key.confirmed) return { saved, records: [] };
  const session = await db.sessions.get(saved.sessionId);
  if (!session) return { saved, records: [] };
  const ctx = { ...loadContextOf(se), unit: saved.unit };
  const entry: PREntry = {
    setId: saved.id,
    sessionId: saved.sessionId,
    key: key.key,
    at: session.startedAt,
    date: session.localDate,
    order: saved.completedAt ? Date.parse(saved.completedAt) : Date.now(),
    loadKg: se.variant.measure === 'reps' ? normalizedLoadKg(saved.load, ctx) : null,
    reps: se.variant.measure === 'reps' ? saved.reps : null,
    durationSec: se.variant.measure === 'time' ? saved.durationSec : null,
    volumeKg: setVolumeKg(saved, ctx),
  };
  return { saved, records: newRecordsFromConfirm(before, entry) };
}

export interface Suggestion {
  load: number | null;
  reps: number | null;
  durationSec: number | null;
  source: 'previous' | 'progression';
  fromDate: string;
}

/** Sugerencias (no son resultados): último registro comparable o una progresión aceptada. */
export async function suggestionsFor(se: SessionExercise): Promise<{ prev: Awaited<ReturnType<typeof previousComparable>>; byOrder: Map<number, Suggestion> }> {
  const prev = await previousComparable(se);
  const byOrder = new Map<number, Suggestion>();
  if (prev) {
    const work = prev.sets.filter((s) => s.kind === 'work');
    work.forEach((s, i) => byOrder.set(i, { load: s.load, reps: s.reps, durationSec: s.durationSec, source: 'previous', fromDate: prev.session.localDate }));
  }
  const key = comparisonKeyOf(se).key;
  const decisions = await db.progressionDecisions.where('comparisonKey').equals(key).toArray();
  const accepted = decisions
    .filter((d) => d.decision === 'accepted' || d.decision === 'adjusted')
    .filter((d) => d.sessionId !== se.sessionId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
  if (accepted && accepted.toLoad !== null && (!prev || accepted.createdAt >= prev.session.startedAt)) {
    for (let i = 0; i < Math.max(se.prescribed.sets, byOrder.size); i++) {
      const cur = byOrder.get(i);
      byOrder.set(i, { load: accepted.toLoad, reps: cur?.reps ?? null, durationSec: cur?.durationSec ?? null, source: 'progression', fromDate: accepted.createdAt.slice(0, 10) });
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

export async function saveEquipmentNote(equipmentId: ID, text: string): Promise<void> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.transaction('rw', db.equipmentNotes, async () => {
    const existing = await db.equipmentNotes.where('equipmentId').equals(equipmentId).first();
    if (existing) await db.equipmentNotes.update(existing.id, { text, updatedAt: now });
    else await db.equipmentNotes.add({ id, equipmentId, text, createdAt: now, updatedAt: now });
  });
}
