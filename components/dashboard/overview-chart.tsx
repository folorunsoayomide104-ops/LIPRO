'use client';
import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ListChecks, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TrendPoint = { label: string; pct: number };

const W = 520;
const H = 168;
const PAD_L = 28;
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 28;
const EASE = [0.22, 1, 0.36, 1] as const;

function buildPoints(pts: TrendPoint[]) {
  const n = pts.length;
  const span = n > 1 ? n - 1 : 1;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  return pts.map((p, i) => ({
    ...p,
    x: n > 1 ? PAD_L + (i / span) * plotW : PAD_L + plotW / 2,
    y: PAD_T + plotH - (Math.min(100, Math.max(0, p.pct)) / 100) * plotH,
  }));
}

/** Smooth cubic path through points (Catmull-Rom → cubic Bezier). */
function smoothLine(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export default function OverviewChart({
  latestPct,
  deltaLatest,
  attemptCount,
  courseCount,
  trend,
  avgScore,
}: {
  latestPct: number | null;
  deltaLatest: number | null;
  attemptCount: number;
  courseCount: number;
  trend: TrendPoint[];
  avgScore?: number | null;
}) {
  const reduced = useReducedMotion();
  const pts = useMemo(() => buildPoints(trend), [trend]);
  const hasLine = pts.length > 1;
  const linePath = hasLine ? smoothLine(pts) : '';
  const baseY = H - PAD_B;
  const areaPath = hasLine
    ? `${linePath} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`
    : '';
  const peak = hasLine ? pts.reduce((m, p) => (p.pct > m.pct ? p : m), pts[0]) : null;
  const last = pts.length ? pts[pts.length - 1] : null;

  const DeltaIcon =
    deltaLatest === null ? Minus : deltaLatest >= 0 ? TrendingUp : TrendingDown;
  const deltaColor =
    deltaLatest === null
      ? 'text-studio-subtle'
      : deltaLatest >= 0
        ? 'text-emerald-400'
        : 'text-rose-400';

  const gridYs = [0, 25, 50, 75, 100].map((pct) => ({
    pct,
    y: PAD_T + (H - PAD_T - PAD_B) - (pct / 100) * (H - PAD_T - PAD_B),
  }));

  const avgY =
    typeof avgScore === 'number'
      ? PAD_T + (H - PAD_T - PAD_B) - (Math.min(100, Math.max(0, avgScore)) / 100) * (H - PAD_T - PAD_B)
      : null;

  return (
    <div className="flex h-full min-h-[220px] flex-col">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-studio-subtle">
            Performance
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-studio-display text-3xl tracking-tight text-studio-fg tabular-nums">
              {latestPct !== null ? `${latestPct}%` : '—'}
            </span>
            {deltaLatest !== null && (
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium', deltaColor)}>
                <DeltaIcon className="h-3.5 w-3.5" />
                {deltaLatest >= 0 ? '+' : ''}
                {deltaLatest}% vs last
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-studio-muted">Latest CBT score trend</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-studio-elevated px-2.5 py-1 text-[11px] font-medium text-studio-muted shadow-studio-border">
          <ListChecks className="h-3 w-3 text-studio-primary" />
          {attemptCount} attempt{attemptCount === 1 ? '' : 's'}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-studio-elevated px-2.5 py-1 text-[11px] font-medium text-studio-muted shadow-studio-border">
          <GraduationCap className="h-3 w-3 text-studio-primary" />
          {courseCount} course{courseCount === 1 ? '' : 's'}
        </span>
        {typeof avgScore === 'number' && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-studio-elevated px-2.5 py-1 text-[11px] font-medium text-studio-muted shadow-studio-border">
            Avg {avgScore}%
          </span>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {!hasLine ? (
          <div className="flex h-[140px] flex-col items-center justify-center rounded-xl bg-studio-elevated/60 px-4 text-center shadow-studio-border">
            <TrendingUp className="mb-2 h-6 w-6 text-studio-subtle" />
            <p className="text-sm font-medium text-studio-fg">No score history yet</p>
            <p className="mt-1 max-w-[16rem] text-xs leading-normal text-studio-muted">
              Complete a CBT practice or exam and your performance trend will appear here.
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="h-auto w-full"
            role="img"
            aria-label="CBT score performance trend"
          >
            <defs>
              <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--studio-primary, #3d9b8f)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--studio-primary, #3d9b8f)" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="perfStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#5cb8ab" />
                <stop offset="100%" stopColor="#b7d4ce" />
              </linearGradient>
            </defs>

            {gridYs.map(({ pct, y }) => (
              <g key={pct}>
                <line
                  x1={PAD_L}
                  y1={y}
                  x2={W - PAD_R}
                  y2={y}
                  stroke="currentColor"
                  className="text-studio-border"
                  strokeOpacity={pct === 0 ? 0.5 : 0.25}
                  strokeWidth={1}
                />
                <text
                  x={PAD_L - 6}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  className="fill-studio-subtle"
                >
                  {pct}
                </text>
              </g>
            ))}

            {avgY != null && (
              <line
                x1={PAD_L}
                y1={avgY}
                x2={W - PAD_R}
                y2={avgY}
                stroke="#5cb8ab"
                strokeOpacity={0.45}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            )}

            <motion.path
              d={areaPath}
              fill="url(#perfFill)"
              initial={{ opacity: reduced ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease: EASE }}
            />

            <motion.path
              d={linePath}
              fill="none"
              stroke="url(#perfStroke)"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: reduced ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.05, ease: EASE }}
            />

            {pts.map((p, i) => {
              const isPeak = peak === p;
              const isLast = last === p;
              return (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isLast || isPeak ? 4.5 : 3}
                    fill={isLast ? '#b7d4ce' : isPeak ? '#5cb8ab' : '#1a2e2b'}
                    stroke={isLast || isPeak ? '#0b0b0c' : '#5cb8ab'}
                    strokeWidth={isLast || isPeak ? 1.5 : 1.25}
                  />
                </g>
              );
            })}

            {peak && peak !== last && (
              <g transform={`translate(${Math.min(Math.max(peak.x - 22, PAD_L), W - PAD_R - 44)}, ${Math.max(peak.y - 28, 4)})`}>
                <rect width="44" height="18" rx="9" fill="#5cb8ab" />
                <text x="22" y="12.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0b0b0c">
                  {peak.pct}%
                </text>
              </g>
            )}

            {last && (
              <g transform={`translate(${Math.min(Math.max(last.x - 22, PAD_L), W - PAD_R - 44)}, ${Math.max(last.y - 28, 4)})`}>
                <rect width="44" height="18" rx="9" fill="#b7d4ce" />
                <text x="22" y="12.5" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0b0b0c">
                  {last.pct}%
                </text>
              </g>
            )}

            {pts.map((p, i) => {
              const show =
                pts.length <= 6 ||
                i === 0 ||
                i === pts.length - 1 ||
                i % Math.ceil(pts.length / 5) === 0;
              if (!show) return null;
              return (
                <text
                  key={`l-${i}`}
                  x={p.x}
                  y={H - 8}
                  textAnchor="middle"
                  fontSize="9"
                  className="fill-studio-subtle"
                >
                  {p.label}
                </text>
              );
            })}
          </svg>
        )}
      </div>
    </div>
  );
}
