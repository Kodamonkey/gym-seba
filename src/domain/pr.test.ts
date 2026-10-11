import { describe, expect, it } from 'vitest';
import { computePRs, eventsForSet, newRecordsFromConfirm, type PREntry } from './pr';

let n = 0;
function entry(p: Partial<PREntry> & { loadKg: number; reps: number }, day = 1): PREntry {
  n += 1;
  return {
    setId: p.setId ?? `set${n}`,
    sessionId: p.sessionId ?? `sess${day}`,
    key: p.key ?? 'k1',
    at: p.at ?? `2026-10-${String(day).padStart(2, '0')}T12:00:${String(n % 60).padStart(2, '0')}.000Z`,
    date: `2026-10-${String(day).padStart(2, '0')}`,
    order: n,
    loadKg: p.loadKg,
    reps: p.reps,
    durationSec: null,
    volumeKg: p.volumeKg ?? p.loadKg * p.reps,
  };
}

describe('récords personales', () => {
  it('distingue primer registro, empate y nuevo récord', () => {
    const a = entry({ loadKg: 40, reps: 10 }, 1);
    const b = entry({ loadKg: 40, reps: 10 }, 2);
    const c = entry({ loadKg: 45, reps: 8 }, 3);
    const r = computePRs([a, b, c]);
    const maxLoad = (id: string) => eventsForSet(r, id).find((e) => e.type === 'max-load')?.status;
    expect(maxLoad(a.setId)).toBe('first');
    expect(maxLoad(b.setId)).toBe('tie');
    expect(maxLoad(c.setId)).toBe('new');
  });

  it('no mezcla contextos de comparación distintos', () => {
    const a = entry({ loadKg: 60, reps: 10, key: 'machine-A' }, 1);
    const b = entry({ loadKg: 50, reps: 10, key: 'machine-B' }, 2);
    const r = computePRs([a, b]);
    expect(eventsForSet(r, b.setId).find((e) => e.type === 'max-load')?.status).toBe('first');
  });

  it('cuenta repeticiones por carga', () => {
    const a = entry({ loadKg: 40, reps: 10 }, 1);
    const b = entry({ loadKg: 40, reps: 12 }, 2);
    const r = computePRs([a, b]);
    const ev = eventsForSet(r, b.setId).find((e) => e.type === 'reps-at-load');
    expect(ev?.status).toBe('new');
    expect(ev?.previous).toBe(10);
  });

  it('recalcula al borrar una serie histórica', () => {
    const a = entry({ loadKg: 50, reps: 10 }, 1);
    const b = entry({ loadKg: 45, reps: 10 }, 2);
    const withA = computePRs([a, b]);
    expect(eventsForSet(withA, b.setId).some((e) => e.type === 'max-load')).toBe(false);
    const withoutA = computePRs([b]);
    expect(eventsForSet(withoutA, b.setId).find((e) => e.type === 'max-load')?.status).toBe('first');
    expect(withoutA.bests.find((x) => x.type === 'max-load')?.value).toBe(45);
  });

  it('una corrección antigua reordena cronológicamente', () => {
    const late = entry({ loadKg: 50, reps: 10 }, 5);
    const early = entry({ loadKg: 55, reps: 10 }, 1);
    const r = computePRs([late, early]);
    expect(eventsForSet(r, early.setId).find((e) => e.type === 'max-load')?.status).toBe('first');
    expect(eventsForSet(r, late.setId).some((e) => e.type === 'max-load')).toBe(false);
  });

  it('calcula volumen de sesión una vez por sesión', () => {
    const s1 = [entry({ loadKg: 40, reps: 10 }, 1), entry({ loadKg: 40, reps: 10 }, 1)];
    const s2 = [entry({ loadKg: 40, reps: 12 }, 2), entry({ loadKg: 40, reps: 10 }, 2)];
    const r = computePRs([...s1, ...s2]);
    const sv = r.events.filter((e) => e.type === 'session-volume');
    expect(sv.map((e) => e.status)).toEqual(['first', 'new']);
    expect(sv[1]?.value).toBe(880);
  });

  it('solo celebra en vivo un récord nuevo, no el primer registro', () => {
    const first = entry({ loadKg: 40, reps: 10 }, 1);
    expect(newRecordsFromConfirm([], first)).toHaveLength(0);
    const better = entry({ loadKg: 42.5, reps: 10 }, 2);
    const ev = newRecordsFromConfirm([first], better);
    expect(ev.map((e) => e.type)).toContain('max-load');
  });
});
