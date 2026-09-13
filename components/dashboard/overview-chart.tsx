'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight as ExpandIcon, ListChecks, GraduationCap } from 'lucide-react';

export type TrendPoint = { label: string; pct: number };

const W = 460;
const H = 140;
const PAD = 20;
const EASE = [0.22, 1, 0.36, 1] as const;

function buildPoints(pts: TrendPoint[]) {
  const n = pts.length;
  const span = n > 1 ? n - 1 : 1;
  return pts.map((p, i) => ({
    ...p,
    x: n > 1 ? PAD + (i / span) * (W - PAD * 2) : W / 2,
    y: H - PAD - (p.pct / 100) * (H - PAD * 2),
  }));
}

export default function OverviewChart({
  latestPct,
  deltaLatest,
  attemptCount,
  courseCount,
  trend,
}: {
  latestPct: number | null;
  deltaLatest: number | null;
  attemptCount: number;
  courseCount: number;
  trend: TrendPoint[];
}) {
  const reduced = useReducedMotion();
  const pts = buildPoints(trend);
  const hasLine = pts.length > 1;
  const linePath = hasLine ? pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') : '';
  const baseY = H - PAD;
  const areaPath = hasLine ? `${linePath} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z` : '';
  const peak = hasLine ? pts.reduce((m, p) => (p.pct > m.pct ? p : m), pts[0]) : null;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-studio-subtle">Score Overview</h3>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tnum heading text-2xl font-bold">{latestPct !== null ? `${latestPct}%` : '—'}</span>
            {deltaLatest !== null && (
              <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${deltaLatest >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {deltaLatest >= 0 ? '↑' : '↓'} {Math.abs(deltaLatest)}% from last attempt
              </span>
            )}
          </div>
        </div>
        <ExpandIcon className="h-4 w-4 shrink-0 text-studio-subtle" />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-studio-border bg-studio-elevated px-2.5 py-1 text-[11px] font-medium text-studio-muted">
          <ListChecks className="h-3 w-3" /> {attemptCount} attempts
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-studio-border bg-studio-elevated px-2.5 py-1 text-[11px] font-medium text-studio-muted">
          <GraduationCap className="h-3 w-3" /> {courseCount} courses
        </span>
      </div>

      <div className="relative mt-auto">
        {!hasLine ? (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-studio-border-strong text-center text-xs text-studio-subtle">
            Complete a couple of CBTs to see your score trend
          </div>
        ) : (
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Score trend">
            <defs>
              <linearGradient id="ov-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b7d4ce" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#b7d4ce" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="ov-stroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#b7d4ce" />
                <stop offset="100%" stopColor="#9ac2b8" />
              </linearGradient>
            </defs>
            <motion.path
              d={areaPath}
              fill="url(#ov-fill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
            />
            <motion.path
              d={linePath}
              fill="none"
              stroke="url(#ov-stroke)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: reduced ? 1 : 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1, ease: EASE }}
            />
            {pts.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={p === peak ? 4 : 2.5} fill="#b7d4ce" opacity={p === peak ? 1 : 0.7} />
            ))}
            {peak && (
              <g transform={`translate(${Math.min(peak.x + 8, W - 60)}, ${Math.max(peak.y - 26, 6)})`}>
                <rect width="52" height="20" rx="10" fill="#b7d4ce" />
                <text x="26" y="14" textAnchor="middle" fontSize="10" fontWeight="700" fill="#0b0b0c">
                  {peak.pct}%
                </text>
              </g>
            )}
            {pts.map((p, i) => (
              <text key={`l-${i}`} x={p.x} y={H - 4} textAnchor="middle" fontSize="9" className="fill-studio-subtle">
                {p.label.split(' ')[1] ?? p.label}
              </text>
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}
