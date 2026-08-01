'use client'

import { motion } from 'framer-motion'
import { Clock, Brain } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export type AttemptItem = {
  id: string
  code: string
  date: string
  pct: number | null
  done: boolean
}

const EASE = [0.22, 1, 0.36, 1] as const

export default function RecentAttempts({ attempts }: { attempts: AttemptItem[] }) {
  if (attempts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-lipro-200/60 p-4 text-center dark:border-lipro-500/20">
        <Brain className="mx-auto h-6 w-6 text-lipro-400" />
        <p className="mt-2 text-sm font-medium">No attempts yet</p>
        <p className="text-xs text-lipro-600/60 dark:text-lipro-200/50">
          Run your first CBT to see your progress here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {attempts.map((a, i) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 + i * 0.07, duration: 0.4, ease: EASE }}
          className="rounded-xl border border-lipro-100/60 bg-white/50 p-3.5 dark:border-lipro-500/10 dark:bg-white/[0.02]"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{a.code}</div>
              <div className="flex items-center gap-1.5 text-xs text-lipro-600/60 dark:text-lipro-200/50">
                <Clock className="h-3 w-3" /> {a.date}
              </div>
            </div>
            {a.pct !== null ? (
              <span
                className={`tnum text-sm font-bold ${
                  a.pct >= 50
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {a.pct}%
              </span>
            ) : (
              <Badge tone="amber">In progress</Badge>
            )}
          </div>
          {a.pct !== null && (
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-lipro-100 dark:bg-lipro-950">
              <motion.div
                className={`h-full rounded-full ${
                  a.pct >= 50 ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${a.pct}%` }}
                transition={{ delay: 0.25 + i * 0.08, duration: 0.9, ease: EASE }}
              />
            </div>
          )}
          {!a.done && (
            <div className="mt-2 text-[11px] font-medium uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Awaiting submission
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}
