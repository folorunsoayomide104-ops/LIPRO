'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'

export type TrendPoint = { label: string; pct: number }

const W = 640
const H = 240
const PAD = 28
const EASE = [0.22, 1, 0.36, 1] as const

function buildPoints(pts: TrendPoint[]) {
  const n = pts.length
  const span = n > 1 ? n - 1 : 1
  return pts.map((p, i) => ({
    ...p,
    x: n > 1 ? PAD + (i / span) * (W - PAD * 2) : W / 2,
    y: H - PAD - (p.pct / 100) * (H - PAD * 2),
  }))
}

export default function ScoreTrend({ points }: { points: TrendPoint[] }) {
  const reduced = useReducedMotion()
  const pts = buildPoints(points)

  if (pts.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 text-center dark:border-white/10">
        <TrendingUp className="mb-3 h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Complete a CBT to unlock your performance trend
        </p>
      </div>
    )
  }

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const baseY = H - PAD
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`
  const last = pts[pts.length - 1]

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Recent CBT score trend"
      >
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity="0.02" />
          </linearGradient>
          <linearGradient id="trend-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7c5cff" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>

        {[25, 50, 75, 100].map((g) => {
          const y = H - PAD - (g / 100) * (H - PAD * 2)
          return (
            <g key={g}>
              <line
                x1={PAD}
                y1={y}
                x2={W - PAD}
                y2={y}
                stroke="currentColor"
                className="text-zinc-200 dark:text-white/10"
                strokeDasharray="3 5"
                strokeWidth="1"
              />
              <text
                x={PAD - 8}
                y={y + 3}
                textAnchor="end"
                fontSize="10"
                className="fill-zinc-400 dark:fill-zinc-500"
              >
                {g}%
              </text>
            </g>
          )
        })}

        <motion.path
          d={areaPath}
          fill="url(#trend-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
        />

        <motion.path
          d={linePath}
          fill="none"
          stroke="url(#trend-stroke)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: reduced ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.2, ease: EASE }}
        />

        {pts.map((p, i) => (
          <motion.g
            key={`${p.label}-${i}`}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 + i * 0.08, duration: 0.35, ease: EASE }}
          >
            <text
              x={p.x}
              y={p.y - 12}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              className="fill-zinc-700 dark:fill-zinc-300"
            >
              {Math.round(p.pct)}%
            </text>
            <circle cx={p.x} cy={p.y} r="4.5" fill="#7c5cff" className="drop-shadow-sm" />
            <circle cx={p.x} cy={p.y} r="8" fill="none" stroke="#7c5cff" strokeOpacity="0.3" />
            <text
              x={p.x}
              y={H - 10}
              textAnchor="middle"
              fontSize="10"
              className="fill-zinc-400 dark:fill-zinc-500"
            >
              {p.label}
            </text>
          </motion.g>
        ))}

        {!reduced && (
          <motion.circle
            cx={last.x}
            cy={last.y}
            r="10"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="1.5"
            initial={{ scale: 0.4, opacity: 0.9 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </svg>
    </div>
  )
}
