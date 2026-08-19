'use client';
import { motion } from 'framer-motion';
import { Brain, ArrowUpRight, Filter } from 'lucide-react';

export type AttemptItem = { id: string; code: string; date: string; pct: number | null; done: boolean };

const EASE = [0.22, 1, 0.36, 1] as const;
const ICON_TONES = ['bg-[#3559F7]', 'bg-[#545AC5]', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];

export default function ActivityList({ attempts }: { attempts: AttemptItem[] }) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="heading text-lg font-bold">Recent Activity</h2>
          <p className="text-sm text-lipro-600/60 dark:text-lipro-200/50">Your latest CBT attempts</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-lipro-200/60 text-lipro-500 dark:border-lipro-500/20">
            <Filter className="h-3.5 w-3.5" />
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-lg border border-lipro-200/60 text-lipro-500 dark:border-lipro-500/20">
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>

      {attempts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-lipro-200/60 p-5 text-center dark:border-lipro-500/20">
          <Brain className="mx-auto h-6 w-6 text-lipro-400" />
          <p className="mt-2 text-sm font-medium">No attempts yet</p>
          <p className="text-xs text-lipro-600/60 dark:text-lipro-200/50">Run your first CBT to see it here.</p>
        </div>
      ) : (
        <div className="divide-y divide-lipro-100/60 dark:divide-white/5">
          {attempts.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 + i * 0.05, duration: 0.35, ease: EASE }}
              className="flex items-center gap-3 py-3"
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white ${ICON_TONES[i % ICON_TONES.length]}`}>
                <Brain className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{a.code}</div>
                <div className="text-xs text-lipro-600/60 dark:text-lipro-200/50">{a.date}</div>
              </div>
              {a.pct !== null ? (
                <span className={`tnum shrink-0 text-sm font-bold ${a.pct >= 50 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {a.pct}%
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  In progress
                </span>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
