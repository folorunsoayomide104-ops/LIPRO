import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'purple' | 'green' | 'amber' | 'rose' | 'indigo';
const tones: Record<Tone, string> = {
  purple: 'bg-lipro-100 text-lipro-700 dark:bg-lipro-950/60 dark:text-lipro-200',
  green: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-200',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200',
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-200',
};

export function Badge({ className, tone = 'purple', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium', tones[tone], className)} {...props} />;
}
