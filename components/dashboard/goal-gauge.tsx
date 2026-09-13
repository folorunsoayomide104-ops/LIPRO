'use client';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

const SIZE = 160;
const R = 62;
const C = 2 * Math.PI * R;
const SWEEP = 300 / 360; // gauge leaves a gap at the bottom, matching the reference
const EASE = [0.22, 1, 0.36, 1] as const;

export default function GoalGauge({
  avgScore,
  bestScore,
}: {
  avgScore: number | null;
  bestScore: number | null;
}) {
  const reduced = useReducedMotion();
  const pct = avgScore ?? 0;
  const frac = (pct / 100) * SWEEP;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-studio-subtle">Average Score</h3>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tnum heading text-2xl font-bold">{avgScore !== null ? `${avgScore}%` : '—'}</span>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-studio-subtle" />
      </div>

      <div className="relative mx-auto mt-2 grid w-full max-w-[160px] place-items-center">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-auto w-full" role="img" aria-label="Average score gauge">
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            className="text-studio-elevated"
            strokeDasharray={`${SWEEP * C} ${C}`}
            transform={`rotate(120 ${SIZE / 2} ${SIZE / 2})`}
          />
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="#b7d4ce"
            strokeWidth="12"
            strokeLinecap="round"
            initial={{ strokeDasharray: `0 ${C}` }}
            animate={{ strokeDasharray: `${frac * C} ${C}` }}
            transition={{ duration: reduced ? 0 : 1, ease: EASE, delay: 0.15 }}
            transform={`rotate(120 ${SIZE / 2} ${SIZE / 2})`}
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-xl font-bold">{avgScore !== null ? `${avgScore}%` : '—'}</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-studio-subtle">Average</span>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-center gap-4 pt-3 text-[11px] font-medium text-studio-subtle">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: '#b7d4ce' }} /> Average</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-studio-elevated" /> Best {bestScore !== null ? `${bestScore}%` : '—'}
        </span>
      </div>
    </div>
  );
}
