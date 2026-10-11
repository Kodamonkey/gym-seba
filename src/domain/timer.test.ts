import { describe, expect, it } from 'vitest';
import {
  ADJUST_STEP_MS,
  adjustRest,
  pauseRest,
  remainingMs,
  resumeRest,
  sessionActiveMs,
  skipRest,
  startRest,
} from './timer';

const T0 = 1_000_000;

describe('temporizador de descanso', () => {
  it('recalcula el restante desde el estado guardado', () => {
    const t = startRest('s1', 'set1', 90_000, T0);
    expect(remainingMs(t, T0 + 30_000)).toBe(60_000);
    // Simula volver de una pestaña suspendida: mismo resultado sin contador en memoria.
    const restored = JSON.parse(JSON.stringify(t));
    expect(remainingMs(restored, T0 + 30_000)).toBe(60_000);
    expect(remainingMs(t, T0 + 200_000)).toBe(0);
  });

  it('pausa y reanuda sin perder tiempo', () => {
    let t = startRest('s1', null, 60_000, T0);
    t = pauseRest(t, T0 + 10_000);
    expect(remainingMs(t, T0 + 50_000)).toBe(50_000);
    t = resumeRest(t, T0 + 50_000);
    expect(remainingMs(t, T0 + 60_000)).toBe(40_000);
  });

  it('ajusta ±15 s sin restantes negativos', () => {
    let t = startRest('s1', null, 20_000, T0);
    t = adjustRest(t, ADJUST_STEP_MS, T0);
    expect(remainingMs(t, T0)).toBe(35_000);
    t = adjustRest(t, -ADJUST_STEP_MS * 4, T0 + 10_000);
    expect(remainingMs(t, T0 + 10_000)).toBe(0);
    expect(t.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('no muestra valores absurdos si el reloj retrocede', () => {
    const t = startRest('s1', null, 60_000, T0);
    expect(remainingMs(t, T0 - 3_600_000)).toBe(60_000);
  });

  it('omitir deja el restante en cero', () => {
    const t = skipRest(startRest('s1', null, 60_000, T0), T0 + 1000);
    expect(remainingMs(t, T0 + 1000)).toBe(0);
  });
});

describe('duración de sesión', () => {
  it('descuenta pausas registradas', () => {
    const start = '2026-10-11T12:00:00.000Z';
    const pauses = [{ start: '2026-10-11T12:10:00.000Z', end: '2026-10-11T12:15:00.000Z' }];
    const now = Date.parse('2026-10-11T12:30:00.000Z');
    expect(sessionActiveMs(start, null, pauses, now)).toBe(25 * 60_000);
  });

  it('una pausa abierta detiene el reloj de sesión', () => {
    const start = '2026-10-11T12:00:00.000Z';
    const pauses = [{ start: '2026-10-11T12:10:00.000Z', end: null }];
    const now = Date.parse('2026-10-11T12:30:00.000Z');
    expect(sessionActiveMs(start, null, pauses, now)).toBe(10 * 60_000);
  });
});
