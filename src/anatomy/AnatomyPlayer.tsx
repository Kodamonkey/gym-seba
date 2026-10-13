import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { MuscleRole } from '../domain/types';
import type { Clip } from './clip';
import { phaseAt } from './clip';
import { buildFrame, SvgStage, type RoleMap } from './render';

const SPEEDS = [0.5, 0.75, 1] as const;
const PLAY_EVENT = 'atlas:demo-play';

export interface AnatomyPlayerProps {
  clip: Clip;
  roles: RoleMap;
  hasStabilizers: boolean;
  autoplay?: boolean;
  reducedMotion?: boolean;
  /** Etiqueta accesible: qué ejercicio se demuestra. */
  label: string;
  compact?: boolean;
}

/** Instante con la mayor amplitud del movimiento (fin de la fase concéntrica). */
function peakT(clip: Clip): number {
  const p = clip.phases[2] ?? clip.phases[1];
  return p ? (p.from + p.to) / 2 : 0.5;
}

export function Scene({ clip, roles, t, stab, title }: { clip: Clip; roles: RoleMap; t: number; stab: boolean; title: string }) {
  const id = useId().replace(/:/g, '');
  const groupRef = useRef<SVGGElement>(null);
  const stageRef = useRef<SvgStage | null>(null);
  useEffect(() => {
    if (!groupRef.current) return;
    stageRef.current = new SvgStage(groupRef.current);
    return () => stageRef.current?.clear();
  }, [clip]);
  useEffect(() => {
    stageRef.current?.update(buildFrame(clip, t, roles));
  }, [clip, roles, t]);
  return (
    <StageSvg clip={clip} id={id} stab={stab} title={title}>
      <g ref={groupRef} />
    </StageSvg>
  );
}

function StageSvg({ clip, id, stab, title, children }: { clip: Clip; id: string; stab: boolean; title: string; children: React.ReactNode }) {
  const [x, y, w, h] = clip.viewBox;
  return (
    <svg
      className="anatomy-stage h-full w-full"
      viewBox={`${x} ${y} ${w} ${h}`}
      role="img"
      aria-label={title}
      data-stab={stab ? 'on' : 'off'}
      style={{ ['--hatch-url' as string]: `url(#hatch-${id})`, ['--dots-url' as string]: `url(#dots-${id})` }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id={`hatch-${id}`} width="2.4" height="2.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2.4" height="2.4" style={{ fill: 'var(--m-syn)' }} />
          <rect width="0.8" height="2.4" style={{ fill: 'var(--m-syn-line)', opacity: 0.55 }} />
        </pattern>
        <pattern id={`dots-${id}`} width="2.2" height="2.2" patternUnits="userSpaceOnUse">
          <rect width="2.2" height="2.2" style={{ fill: 'var(--m-stab)' }} />
          <circle cx="1.1" cy="1.1" r="0.45" style={{ fill: '#ffffff', opacity: 0.55 }} />
        </pattern>
      </defs>
      {children}
    </svg>
  );
}

/**
 * Reproductor de demostraciones anatómicas renderizadas en vivo (SVG).
 * Capacidades reales: reproducir/pausar, reiniciar, velocidad, posición, ampliar y capa de estabilizadores.
 * No hay audio. Sin autoplay salvo preferencia explícita; con movimiento reducido muestra inicio y fin.
 */
export function AnatomyPlayer({ clip, roles, hasStabilizers, autoplay = false, reducedMotion = false, label, compact }: AnatomyPlayerProps) {
  const instance = useId();
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(autoplay && !reducedMotion);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [stab, setStab] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<number | null>(null);
  const [staticFrames, setStaticFrames] = useState(reducedMotion);

  useEffect(() => setStaticFrames(reducedMotion), [reducedMotion]);

  // Solo una demostración se reproduce a la vez.
  useEffect(() => {
    const onOther = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== instance) setPlaying(false);
    };
    window.addEventListener(PLAY_EVENT, onOther);
    return () => window.removeEventListener(PLAY_EVENT, onOther);
  }, [instance]);

  useEffect(() => {
    if (playing) window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: instance }));
  }, [playing, instance]);

  // Pausa si sale de pantalla o la pestaña se oculta.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => !e.isIntersecting)) setPlaying(false);
    });
    io.observe(el);
    const onVis = () => document.hidden && setPlaying(false);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastRef.current = null;
      return;
    }
    const step = (now: number) => {
      const last = lastRef.current ?? now;
      lastRef.current = now;
      const dt = Math.min(0.1, (now - last) / 1000);
      tRef.current = (tRef.current + (dt * speed) / clip.seconds) % 1;
      setT(tRef.current);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, clip.seconds]);

  useEffect(() => {
    tRef.current = 0;
    setT(0);
  }, [clip]);

  const restart = useCallback(() => {
    tRef.current = 0;
    setT(0);
    setStaticFrames(false);
    setPlaying(true);
  }, []);

  const phase = phaseAt(clip.phases, t);
  const title = `Demostración: ${label}. ${clip.viewLabel}.`;

  const stage = staticFrames ? (
    <div className="grid h-full grid-cols-2 gap-1">
      <figure className="relative h-full">
        <Scene clip={clip} roles={roles} t={0} stab={stab} title={`${title} Posición inicial.`} />
        <figcaption className="absolute bottom-1 left-1 rounded bg-surface/80 px-1.5 text-xs">Inicio</figcaption>
      </figure>
      <figure className="relative h-full">
        <Scene clip={clip} roles={roles} t={peakT(clip)} stab={stab} title={`${title} Posición final.`} />
        <figcaption className="absolute bottom-1 left-1 rounded bg-surface/80 px-1.5 text-xs">Final del recorrido</figcaption>
      </figure>
    </div>
  ) : (
    <Scene clip={clip} roles={roles} t={t} stab={stab} title={title} />
  );

  const controls = (
    <div className="flex flex-wrap items-center gap-2 px-2 py-2">
      <button
        type="button"
        className="inline-flex h-11 min-w-11 items-center justify-center rounded-lg bg-surface-3 px-3 font-medium"
        onClick={() => {
          setStaticFrames(false);
          setPlaying((x) => !x);
        }}
        aria-pressed={playing}
      >
        {playing ? '❚❚ Pausa' : '▶ Reproducir'}
      </button>
      <button type="button" className="h-11 min-w-11 rounded-lg bg-surface-3 px-3" onClick={restart} aria-label="Reiniciar demostración">
        ↺
      </button>
      <label className="flex items-center gap-1 text-sm text-muted">
        <span className="sr-only">Velocidad</span>
        <select
          className="h-11 rounded-lg bg-surface-3 px-2 text-text"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value) as (typeof SPEEDS)[number])}
          aria-label="Velocidad de reproducción"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {String(s).replace('.', ',')}×
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="h-11 rounded-lg bg-surface-3 px-3"
        onClick={() => {
          setPlaying(false);
          setStaticFrames((x) => !x);
        }}
        aria-pressed={staticFrames}
      >
        {staticFrames ? 'Animación' : 'Inicio / fin'}
      </button>
      {hasStabilizers && (
        <label className="flex h-11 items-center gap-2 rounded-lg bg-surface-3 px-3 text-sm">
          <input type="checkbox" checked={stab} onChange={(e) => setStab(e.target.checked)} />
          Estabilizadores
        </label>
      )}
      <button
        type="button"
        className="h-11 rounded-lg bg-surface-3 px-3"
        onClick={() => setExpanded((x) => !x)}
        aria-expanded={expanded}
      >
        {expanded ? 'Reducir' : 'Ampliar'}
      </button>
    </div>
  );

  return (
    <div ref={containerRef} className={expanded ? 'fixed inset-0 z-50 flex flex-col bg-bg p-2' : 'flex flex-col'}>
      <div
        className={
          expanded
            ? 'min-h-0 flex-1 overflow-hidden rounded-xl border border-line'
            : `${compact ? 'aspect-[4/3]' : 'aspect-[16/12]'} overflow-hidden rounded-xl border border-line`
        }
      >
        {stage}
      </div>
      {!staticFrames && (
        <div className="flex items-center gap-2 px-2 pt-2">
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(t * 1000)}
            onChange={(e) => {
              setPlaying(false);
              tRef.current = Number(e.target.value) / 1000;
              setT(tRef.current);
            }}
            className="min-h-11 w-full accent-[var(--accent)]"
            aria-label="Posición dentro del movimiento"
          />
        </div>
      )}
      <p className="px-2 pt-1 text-sm">
        <span className="text-muted">{clip.viewLabel}</span>
        {clip.sideLabel && <span className="text-muted"> · {clip.sideLabel}</span>}
        {!staticFrames && phase && (
          <>
            {' · '}
            <strong className="font-semibold">{phase.label}</strong>
          </>
        )}
      </p>
      {controls}
    </div>
  );
}

export function useRoleMap(muscles: { muscleId: string; role: MuscleRole }[], regionsOf: (id: string) => string[]): RoleMap {
  return useMemo(() => {
    const m = new Map<string, MuscleRole>();
    const rank: Record<MuscleRole, number> = { target: 3, synergist: 2, stabilizer: 1 };
    for (const r of muscles) {
      for (const region of regionsOf(r.muscleId)) {
        const prev = m.get(region);
        if (!prev || rank[r.role] > rank[prev]) m.set(region, r.role);
      }
    }
    return m;
  }, [muscles, regionsOf]);
}
