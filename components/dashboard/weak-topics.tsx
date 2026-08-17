'use client'

import { motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import { AlertTriangle, FileText, GraduationCap } from 'lucide-react'

export type WeakTopicItem = {
  key: string
  label: string
  kind: 'course' | 'material'
  accuracyPct: number
  answered: number
}

const EASE = [0.22, 1, 0.36, 1] as const

function bandFor(pct: number) {
  if (pct < 50) return { bar: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-300', chip: 'border-rose-500/20 bg-rose-500/10' }
  if (pct < 70) return { bar: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-300', chip: 'border-amber-500/20 bg-amber-500/10' }
  return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-300', chip: 'border-emerald-500/20 bg-emerald-500/10' }
}

export default function WeakTopics({ topics }: { topics: WeakTopicItem[] }) {
  const reduced = useReducedMotion()

  if (topics.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-lipro-200/60 p-5 text-center text-sm text-lipro-600/60 dark:border-lipro-700/40">
        Take a few more CBT attempts and we&apos;ll surface which courses need the most revision.
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {topics.map((t, i) => {
        const band = bandFor(t.accuracyPct)
        return (
          <motion.li
            key={t.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * i, duration: reduced ? 0 : 0.4, ease: EASE }}
            className="rounded-xl p-3.5 glass-hover"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${band.chip} ${band.text}`}>
                  {t.kind === 'course' ? <GraduationCap className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                </span>
                <span className="truncate text-sm font-semibold">{t.label}</span>
              </div>
              <span className={`tnum shrink-0 text-xs font-bold ${band.text}`}>{t.accuracyPct}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-white/5">
              <motion.div
                className={`h-full rounded-full ${band.bar}`}
                initial={{ width: 0 }}
                animate={{ width: `${t.accuracyPct}%` }}
                transition={{ delay: 0.15 + 0.06 * i, duration: reduced ? 0 : 0.6, ease: EASE }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-lipro-600/50 dark:text-lipro-200/40">
              From {t.answered} graded {t.answered === 1 ? 'answer' : 'answers'}
              {t.accuracyPct < 50 && (
                <span className="ml-1.5 inline-flex items-center gap-1 text-rose-500 dark:text-rose-300">
                  <AlertTriangle className="h-3 w-3" /> Needs focus
                </span>
              )}
            </p>
          </motion.li>
        )
      })}
      <Link href="/cbt" className="inline-flex items-center gap-1 text-xs font-semibold text-lipro-600 hover:underline dark:text-lipro-300">
        Practice a weak course &rarr;
      </Link>
    </ul>
  )
}
