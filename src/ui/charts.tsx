import { useId, useMemo, useState, type ReactNode } from 'react';

/**
 * Gráficos SVG de una sola serie: líneas de 2 px, marcadores r ≥ 4 con anillo de superficie,
 * barras ≤ 24 px con extremo redondeado anclado a la base, rejilla discreta, tooltip al pasar
 * o tocar, y tabla equivalente siempre disponible. Los huecos de datos no se rellenan con cero.
 */

export interface Point {
  /** Etiqueta del eje X (fecha o semana). */
  label: string;
  value: number | null;
  /** Texto del tooltip y de la tabla. */
  detail?: string;
  href?: string;
}

const W = 340;
const H = 170;
const PAD = { l: 38, r: 12, t: 14, b: 28 };

function niceTicks(min: number, max: number, count = 4, integer = false): number[] {
  if (min === max) {
    const d = Math.abs(min) || 1;
    min -= d * 0.5;
    max += d * 0.5;
  }
  const span = max - min;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  let step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? mag * 10;
  if (integer) step = Math.max(1, Math.round(step));
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v * 1000) / 1000);
  return out;
}

const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

function Frame({
  title,
  summary,
  unit,
  points,
  children,
  tableHeader,
}: {
  title: string;
  summary: string;
  unit: string;
  points: Point[];
  children: ReactNode;
  tableHeader: [string, string];
}) {
  const [table, setTable] = useState(false);
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="font-semibold">{title}</span>
        <button type="button" className="min-h-10 rounded-lg px-2 text-sm text-accent underline" aria-pressed={table} onClick={() => setTable((x) => !x)}>
          {table ? 'Ver gráfico' : 'Ver tabla'}
        </button>
      </figcaption>
      {table ? (
        <div className="max-h-72 overflow-auto rounded-lg border border-line">
          <table className="w-full text-sm tabular">
            <thead className="bg-surface-2 text-left text-muted">
              <tr>
                <th className="px-2 py-1 font-medium">{tableHeader[0]}</th>
                <th className="px-2 py-1 font-medium">{tableHeader[1]}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={`${p.label}-${i}`} className="border-t border-line">
                  <td className="px-2 py-1">{p.href ? <a href={p.href} className="text-accent underline">{p.label}</a> : p.label}</td>
                  <td className="px-2 py-1">{p.value === null ? 'sin datos' : `${fmt(p.value)} ${unit}`}{p.detail ? ` · ${p.detail}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div role="img" aria-label={`${title}. ${summary}`}>
          {children}
        </div>
      )}
    </figure>
  );
}

function Tooltip({ x, y, text }: { x: number; y: number; text: string }) {
  const w = Math.min(160, 8 + text.length * 5.6);
  const tx = Math.min(W - w - 2, Math.max(2, x - w / 2));
  const ty = Math.max(2, y - 30);
  return (
    <g pointerEvents="none">
      <rect x={tx} y={ty} width={w} height={22} rx={6} fill="var(--surface-3)" stroke="var(--border)" />
      <text x={tx + w / 2} y={ty + 15} textAnchor="middle" fontSize={11} fill="var(--text)">
        {text}
      </text>
    </g>
  );
}

export function LineChart({ title, points, unit, tableHeader = ['Fecha', 'Valor'] }: { title: string; points: Point[]; unit: string; tableHeader?: [string, string] }) {
  const [hover, setHover] = useState<number | null>(null);
  const clipId = useId();
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  const ticks = useMemo(() => (vals.length ? niceTicks(Math.min(...vals), Math.max(...vals)) : [0, 1]), [vals.join(',')]);
  if (vals.length === 0) return <p className="text-sm text-muted">{title}: sin datos en este período.</p>;
  const lo = ticks[0]!;
  const hi = ticks[ticks.length - 1]!;
  const n = points.length;
  const x = (i: number) => PAD.l + (n === 1 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (n - 1));
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo || 1)) * (H - PAD.t - PAD.b);
  // Segmentos solo entre puntos consecutivos con datos (sin inventar valores en los huecos).
  const segs: string[] = [];
  let cur = '';
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur) segs.push(cur);
      cur = '';
      return;
    }
    cur += `${cur ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  const lastIdx = points.map((p) => p.value !== null).lastIndexOf(true);
  const last = points[lastIdx]!;
  const summary = `${vals.length} registros, de ${fmt(vals[0]!)} a ${fmt(vals[vals.length - 1]!)} ${unit}; máximo ${fmt(Math.max(...vals))} ${unit}.`;

  return (
    <Frame title={title} summary={summary} unit={unit} points={points} tableHeader={tableHeader}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onPointerLeave={() => setHover(null)}>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={W} height={H} />
        </clipPath>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--faint)">
              {fmt(t)}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 8} fontSize={10} fill="var(--faint)">
          {points[0]!.label}
        </text>
        {n > 1 && (
          <text x={W - PAD.r} y={H - 8} fontSize={10} textAnchor="end" fill="var(--faint)">
            {points[n - 1]!.label}
          </text>
        )}
        {segs.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--chart)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {hover !== null && points[hover]?.value != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="var(--faint)" strokeWidth={1} />}
        {points.map((p, i) =>
          p.value === null ? null : (
            <circle key={i} cx={x(i)} cy={y(p.value)} r={hover === i ? 5.5 : 4} fill="var(--chart)" stroke="var(--surface)" strokeWidth={2} />
          ),
        )}
        <text x={Math.min(W - PAD.r, x(lastIdx) + 2)} y={y(last.value!) - 9} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--text)">
          {fmt(last.value!)} {unit}
        </text>
        {points.map((_p, i) => (
          <rect
            key={`hit-${i}`}
            x={x(i) - (W - PAD.l - PAD.r) / Math.max(1, n - 1) / 2}
            y={0}
            width={Math.max(18, (W - PAD.l - PAD.r) / Math.max(1, n - 1))}
            height={H}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
            onPointerDown={() => setHover(i)}
          />
        ))}
        {hover !== null && points[hover]?.value != null && (
          <Tooltip x={x(hover)} y={y(points[hover]!.value!)} text={`${points[hover]!.label}: ${fmt(points[hover]!.value!)} ${unit}${points[hover]!.detail ? ` · ${points[hover]!.detail}` : ''}`} />
        )}
      </svg>
    </Frame>
  );
}

export function BarChart({ title, points, unit, tableHeader = ['Período', 'Valor'], integer = false }: { title: string; points: Point[]; unit: string; tableHeader?: [string, string]; integer?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const vals = points.map((p) => p.value ?? 0);
  if (points.length === 0) return <p className="text-sm text-muted">{title}: sin datos en este período.</p>;
  const ticks = niceTicks(0, Math.max(1, ...vals), 3, integer);
  const hi = ticks[ticks.length - 1]!;
  const n = points.length;
  const band = (W - PAD.l - PAD.r) / n;
  const bw = Math.min(24, band - 2);
  const y = (v: number) => PAD.t + (1 - v / hi) * (H - PAD.t - PAD.b);
  const base = H - PAD.b;
  const summary = `${n} períodos; total ${fmt(vals.reduce((a, b) => a + b, 0))} ${unit}.`;
  const r = 4;
  return (
    <Frame title={title} summary={summary} unit={unit} points={points} tableHeader={tableHeader}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize={10} fill="var(--faint)">
              {fmt(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) => {
          const cx = PAD.l + band * i + band / 2;
          if (p.value === null) {
            return (
              <text key={i} x={cx} y={base - 4} textAnchor="middle" fontSize={9} fill="var(--faint)">
                s/d
              </text>
            );
          }
          const top = y(p.value);
          const h = base - top;
          const rr = Math.min(r, h / 2, bw / 2);
          const x0 = cx - bw / 2;
          const d =
            h <= 0
              ? ''
              : `M${x0},${base}V${top + rr}Q${x0},${top} ${x0 + rr},${top}H${x0 + bw - rr}Q${x0 + bw},${top} ${x0 + bw},${top + rr}V${base}Z`;
          return (
            <g key={i}>
              {d && <path d={d} fill="var(--chart)" opacity={hover === null || hover === i ? 1 : 0.6} />}
              {h <= 0 && <line x1={x0} x2={x0 + bw} y1={base - 0.5} y2={base - 0.5} stroke="var(--chart)" strokeWidth={1} />}
              <rect x={cx - band / 2} y={0} width={band} height={H} fill="transparent" onPointerEnter={() => setHover(i)} onPointerDown={() => setHover(i)} />
            </g>
          );
        })}
        <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} stroke="var(--faint)" strokeWidth={1} />
        <text x={PAD.l} y={H - 8} fontSize={10} fill="var(--faint)">
          {points[0]!.label}
        </text>
        {n > 1 && (
          <text x={W - PAD.r} y={H - 8} fontSize={10} textAnchor="end" fill="var(--faint)">
            {points[n - 1]!.label}
          </text>
        )}
        {hover !== null && (
          <Tooltip
            x={PAD.l + band * hover + band / 2}
            y={y(points[hover]!.value ?? 0)}
            text={`${points[hover]!.label}: ${points[hover]!.value === null ? 'sin datos' : `${fmt(points[hover]!.value!)} ${unit}`}`}
          />
        )}
      </svg>
    </Frame>
  );
}
