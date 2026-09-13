import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'purple' | 'green' | 'amber' | 'rose' | 'indigo';
// 'purple' and 'indigo' are kept as prop names (used all over the dashboard)
// but no longer render actual purple/indigo — the whole dashboard moved to
// the studio-* sage-green palette, so these now map onto it instead. Two
// distinct shades so callers using both tones on the same card still read
// as two different badges, not one repeated color.
const tones: Record<Tone, string> = {
  purple: 'bg-studio-primary/15 text-studio-primary',
  green: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-200',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-200',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200',
  indigo: 'bg-studio-elevated text-studio-muted shadow-studio-border',
};

export function Badge({ className, tone = 'purple', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium', tones[tone], className)} {...props} />;
}
