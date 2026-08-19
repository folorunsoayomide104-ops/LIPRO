'use client';
import { motion } from 'framer-motion';
import { GraduationCap, ArrowUpRight } from 'lucide-react';

export type CourseActivity = { code: string; count: number };

const EASE = [0.22, 1, 0.36, 1] as const;
const TONES = ['bg-[#3559F7]', 'bg-[#545AC5]', 'bg-emerald-500', 'bg-amber-500'];

export default function CourseBreakdown({
  totalActivity,
  courses,
  overflow,
}: {
  totalActivity: number;
  courses: CourseActivity[];
  overflow: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-lipro-600/70 dark:text-lipro-200/60">Study by Course</h3>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="tnum heading text-2xl font-bold">{totalActivity}</span>
            <span className="text-xs font-medium text-lipro-600/60 dark:text-lipro-200/50">notes &amp; attempts</span>
          </div>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-lipro-400" />
      </div>

      {courses.length === 0 ? (
        <p className="mt-4 text-sm text-lipro-600/60 dark:text-lipro-200/50">
          Save a note or run a CBT to see your activity by course.
        </p>
      ) : (
        <div className="mt-auto flex items-end gap-2 pt-4">
          {courses.map((c, i) => (
            <motion.div
              key={c.code}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.06, duration: 0.35, ease: EASE }}
              className="flex flex-col items-center gap-1.5"
              title={`${c.code} · ${c.count}`}
            >
              <span className={`grid h-10 w-10 place-items-center rounded-xl text-white ${TONES[i % TONES.length]}`}>
                <GraduationCap className="h-4 w-4" />
              </span>
              <span className="text-[10px] font-medium text-lipro-600/70 dark:text-lipro-200/50">{c.code}</span>
            </motion.div>
          ))}
          {overflow > 0 && (
            <div className="flex flex-col items-center gap-1.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-lipro-100 text-xs font-bold text-lipro-600 dark:bg-white/5 dark:text-lipro-200">
                +{overflow}
              </span>
              <span className="text-[10px] font-medium text-lipro-600/50 dark:text-lipro-200/40">more</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
