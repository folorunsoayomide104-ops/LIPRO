'use client';

import { useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, ListChecks, GraduationCap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TrendPoint = {
  label: string;
  pct: number;
  /** Optional secondary label (e.g. course code) */
  sub?: string;
};

const W = 520;
const H = 168;
const PAD_L = 28;
const PAD_R = 12;
const PAD_T = 18;
const PAD_B = 28;
const EASE = [0.22, 1, 0.36, 1] as const;
const PASS = 50;

function buildPoints(pts: TrendPoint[]) {
  const n = pts.length;
  const span = n > 1 ? n - 1 : 1;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  return pts.map((p, i) => ({
    ...p,
    x: n > 1 ? PAD_L + (i / span) * innerW : PAD_L + innerW / 2,
    y: PAD_T + innerH - (Math.min(100, Math.max(0, p.pct)) / 100) * innerH,
  }));
}

function smoothLine(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function yForPct(pct: number) {
  const innerH = H - PAD_T - PAD_B;
  return PAD_T + innerH - (Math.min(100, Math.max(0, pct)) / 100) * innerH;
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
  const [hover, setHover] = useState<number | null>(null);

  const pts = useMemo(() => buildPoints(trend), [trend]);
  const hasLine = pts.length > 1;
  const single = pts.length === 1;

  const linePath = hasLine ? smoothLine(pts) : '';
  const baseY = H - PAD_B;
  const areaPath = hasLine
    ? `${linePath} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`
    : '';

  const seriesAvg = trend.length
    ? Math.round(trend.reduce((s, p) => s + p.pct, 0) / trend.length)
    : null;
  const seriesHigh = trend.length ? Math.max(...trend.map((p) => p.pct)) : null;
  const seriesLow = trend.length ? Math.min(...trend.map((p) => p.pct)) : null;

  const deltaTone =
    deltaLatest === null ? 'neutral' : deltaLatest > 0 ? 'up' : deltaLatest < 0 ? 'down' : 'neutral';

  const labelIdx = useMemo(() => {
    const n = pts.length;
    if (n <= 6) return new Set(pts.map((_, i) => i));
    const set = new Set<number>([0, n - 1]);
    const step = Math.ceil((n - 1) / 4);
    for (let i = step; i < n - 1; i += step) set.add(i);
    return set;
  }, [pts]);

  const active = hover !== null ? pts[hover] : pts.length ? pts[pts.length - 1] : null;

  return (
    <div className="flex h-full min-h-[220px] flex-col">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-studio-subtle">
            Performance trend
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="tnum heading text-2xl font-bold tracking-tight text-studio-fg md:text-3xl">
              {latestPct !== null ? `${latestPct}%` : '—'}
            </span>
            {deltaLatest !== null && (
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  deltaTone === 'up' && 'bg-emerald-500/15 text-emerald-400',
                  deltaTone === 'down' && 'bg-rose-500/15 text-rose-400',
                  deltaTone === 'neutral' && 'bg-studio-elevated text-studio-muted',
                )}
              >
                {deltaTone === 'up' && <TrendingUp className="h-3 w-3" />}
                {deltaTone === 'down' && <TrendingDown className="h-3 w-3" />}
                {deltaTone === 'neutral' && <Minus className="h-3 w-3" />}
                {deltaLatest > 0 ? '+' : ''}
                {deltaLatest}%
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[11px] text-studio-subtle">
            {trend.length > 0
              ? `Last ${trend.length} scored attempt${trend.length === 1 ? '' : 's'}`
              : 'No scored attempts yet'}
          </p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-studio-elevated text-studio-primary shadow-studio-border">
          <Activity className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-studio-elevated px-2.5 py-1 text-[10px] font-medium text-studio-muted shadow-studio-border">
          <ListChecks className="h-3 w-3" /> {attemptCount} total
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-studio-elevated px-2.5 py-1 text-[10px] font-medium text-studio-muted shadow-studio-border">
          <GraduationCap className="h-3 w-3" /> {courseCount} courses
        </span>
        {(typeof avgScore === 'number' ? avgScore : seriesAvg) !== null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-studio-elevated px-2.5 py-1 text-[10px] font-medium text-studio-muted shadow-studio-border">
            Avg {typeof avgScore === 'number' ? avgScore : seriesAvg}%
          </span>
        )}
        {seriesHigh !== null && seriesLow !== null && seriesHigh !== seriesLow && (
          <span className="inline-flex items-center gap-1 rounded-full bg-studio-elevated px-2.5 py-1 text-[10px] font-medium text-studio-muted shadow-studio-border">
            {seriesLow}–{seriesHigh}%
          </span>
        )}
      </div>

      <div className="relative mt-auto min-h-[9rem]">
        {!hasLine && !single ? (
          <div className="flex h-28 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-studio-border-strong bg-studio-elevated/40 px-4 text-center">
            <Activity className="h-5 w-5 text-studio-subtle" />
            <p className="text-xs font-medium text-studio-muted">No trend yet</p>
            <p className="text-[11px] text-studio-subtle">
              Complete two or more CBT exams to unlock your score curve
            </p>
          </div>
        ) : (
          <div className="relative">
            {active && (
              <div className="pointer-events-none absolute -top-0.5 right-0 z-10 rounded-lg bg-studio-surface/95 px-2.5 py-1 text-right shadow-studio-border backdrop-blur-sm">
                <p className="tnum text-sm font-bold text-studio-fg">{active.pct}%</p>
                <p className="text-[10px] text-studio-subtle">
                  {active.label}
                  {active.sub ? ` · ${active.sub}` : ''}
                </p>
              </div>
            )}

            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="h-auto w-full select-none"
              role="img"
              aria-label="CBT performance trend over recent attempts"
              onMouseLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id="perf-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--studio-primary, #6b9e90)" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="var(--studio-primary, #6b9e90)" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="perf-stroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7eb3a5" />
                  <stop offset="55%" stopColor="#b7d4ce" />
                  <stop offset="100%" stopColor="#9ac2b8" />
                </linearGradient>
                <filter id="perf-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {[0, 25, 50, 75, 100].map((g) => {
                const y = yForPct(g);
                const isPass = g === PASS;
                return (
                  <g key={g}>
                    <line
                      x1={PAD_L}
                      x2={W - PAD_R}
                      y1={y}
                      y2={y}
                      stroke={isPass ? 'rgba(251, 191, 36, 0.35)' : 'currentColor'}
                      strokeOpacity={isPass ? 1 : 0.08}
                      strokeWidth={isPass ? 1.25 : 1}
                      strokeDasharray={isPass ? '4 4' : undefined}
                    />
                    <text
                      x={PAD_L - 6}
                      y={y + 3}
                      textAnchor="end"
                      fontSize="9"
                      className="fill-studio-subtle"
                      opacity={0.85}
                    >
                      {g}
                    </text>
                  </g>
                );
              })}

              {typeof avgScore === 'number' && (
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={yForPct(avgScore)}
                  y2={yForPct(avgScore)}
                  stroke="#7eb3a5"
                  strokeOpacity={0.5}
                  strokeWidth={1.25}
                  strokeDasharray="5 4"
                />
              )}

              {hasLine && (
                <>
                  <motion.path
                    d={areaPath}
                    fill="url(#perf-fill)"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
                  />
                  <motion.path
                    d={linePath}
                    fill="none"
                    stroke="url(#perf-stroke)"
                    strokeWidth="2.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={reduced ? undefined : 'url(#perf-glow)'}
                    initial={{ pathLength: reduced ? 1 : 0, opacity: 0.4 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.05, ease: EASE }}
                  />
                </>
              )}

              {pts.map((p, i) => {
                const isActive = hover === i || (hover === null && i === pts.length - 1);
                const isPeak = seriesHigh !== null && p.pct === seriesHigh;
                return (
                  <g key={i}>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={14}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHover(i)}
                      onFocus={() => setHover(i)}
                    />
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isActive ? 5 : isPeak ? 4 : 3}
                      fill={isActive ? '#d4ebe5' : '#9ac2b8'}
                      stroke="#0b0b0c"
                      strokeWidth={isActive ? 1.5 : 1}
                      opacity={isActive ? 1 : 0.85}
                      className="pointer-events-none"
                    />
                    {labelIdx.has(i) && (
                      <text
                        x={p.x}
                        y={H - 8}
                        textAnchor="middle"
                        fontSize="9"
                        className="fill-studio-subtle"
                      >
                        {p.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-studio-subtle">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-0.5 w-3 rounded-full bg-[#9ac2b8]" /> Score
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-px w-3 border-t border-dashed border-amber-400/70" /> {PASS}% mark
              </span>
              {typeof avgScore === 'number' && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-px w-3 border-t border-dashed border-[#7eb3a5]/70" /> Your avg
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
