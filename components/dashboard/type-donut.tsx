'use client'

import { motion, useReducedMotion } from 'framer-motion'
import AnimatedNumber from './animated-number'

export type DonutSlice = { type: string; count: number }

const SIZE = 220
const R = 84
const C = 2 * Math.PI * R
const EASE = [0.22, 1, 0.36, 1] as const

const TYPE_COLORS: Record<string, string> = {
  MCQ: '#7c5cff',
  TRUE_FALSE: '#22d3ee',
  FILL_BLANK: '#34d399',
  THEORY: '#f59e0b',
  ESSAY: '#f472b6',
}

const TYPE_LABELS: Record<string, string> = {
  MCQ: 'Multiple choice',
  TRUE_FALSE: 'True / False',
  FILL_BLANK: 'Fill in blank',
  THEORY: 'Theory',
  ESSAY: 'Essay',
}

export default function TypeDonut({ slices }: { slices: DonutSlice[] }) {
  const reduced = useReducedMotion()
  const total = slices.reduce((acc, s) => acc + s.count, 0)

  if (total === 0) return null

  let acc = 0
  const segs = slices.map((s) => {
    const f = s.count / total
    const start = acc
    acc += f
    return { ...s, f, start }
  })

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth="18"
            className="text-zinc-100 dark:text-white/5"
          />
          {segs.map((s, i) => (
            <motion.circle
              key={s.type}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={TYPE_COLORS[s.type] ?? '#a1a1aa'}
              strokeWidth="18"
              pathLength={1}
              strokeDasharray={`${s.f} ${1 - s.f}`}
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              initial={{ strokeDashoffset: s.start + s.f, opacity: 0 }}
              animate={{ strokeDashoffset: s.start, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.1, duration: reduced ? 0 : 0.8, ease: EASE }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <AnimatedNumber
            value={total}
            className="tnum block text-3xl font-bold text-zinc-900 dark:text-white"
          />
          <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
            questions
          </span>
        </div>
      </div>

      <ul className="grid w-full grid-cols-2 gap-2">
        {segs.map((s, i) => (
          <motion.li
            key={s.type}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.06, duration: 0.35, ease: EASE }}
            className="flex items-center gap-2 rounded-xl border border-zinc-100 px-3 py-2 dark:border-white/5"
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: TYPE_COLORS[s.type] ?? '#a1a1aa' }}
            />
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">
                {TYPE_LABELS[s.type] ?? s.type}
              </p>
              <p className="tnum text-[11px] text-zinc-400 dark:text-zinc-500">
                {s.count} · {Math.round(s.f * 100)}%
              </p>
            </div>
          </motion.li>
        ))}
      </ul>
    </div>
  )
}
