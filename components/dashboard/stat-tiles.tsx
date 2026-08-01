'use client'

import { motion } from 'framer-motion'
import { GraduationCap, FileQuestion, BookOpen, Wallet } from 'lucide-react'
import AnimatedNumber from './animated-number'
import AmbientBackground from './ambient-bg'

export type StatTileData = {
  label: string
  value: number
  format?: 'ngn'
  accent: string
  chip: string
  icon: 'courses' | 'cbt' | 'notes' | 'wallet'
  sub?: string
}

const ICONS = {
  courses: GraduationCap,
  cbt: FileQuestion,
  notes: BookOpen,
  wallet: Wallet,
}

const FORMATTERS: Record<'ngn', (v: number) => string> = {
  ngn: (v) => '₦' + Math.max(0, Math.round(v)).toLocaleString('en-NG'),
}

const EASE = [0.22, 1, 0.36, 1] as const

export default function StatTiles({ stats }: { stats: StatTileData[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((s, i) => {
        const Icon = ICONS[s.icon]
        const fmt = s.format ? FORMATTERS[s.format] : undefined
        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.07, duration: 0.5, ease: EASE }}
            whileHover={{ y: -4 }}
            className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-[0_1px_2px_rgba(17,17,35,0.05)] transition-shadow hover:shadow-[0_16px_40px_-16px_rgba(17,17,35,0.22)] dark:border-white/10 dark:bg-surface-dark"
          >
            <AmbientBackground variant="sheen" />
            <div
              className={`absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-[0.12] blur-2xl transition-transform duration-500 group-hover:scale-150 ${s.chip}`}
            />
            <div className="relative">
              <div className="flex items-center justify-between">
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${s.chip}`}
              >
                <Icon className="h-5 w-5 text-inherit" />
              </span>
            </div>
            <div className="mt-4">
              <AnimatedNumber
                value={s.value}
                format={fmt}
                className={`heading tnum block text-2xl font-bold leading-none ${s.accent}`}
              />
              <p className="mt-1.5 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {s.label}
              </p>
              {s.sub ? (
                <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{s.sub}</p>
              ) : null}
            </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}
