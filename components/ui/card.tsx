import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass glass-hover rounded-2xl p-6', className)} {...props} />;
}
export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  // Stacked by default: nearly every call site passes a bare CardTitle +
  // CardDescription expecting them on top of each other. The previous
  // `flex items-start justify-between` treated those as two separate flex
  // items pushed to opposite ends of the row instead — on a narrow phone
  // that squeezed both into two cramped side-by-side columns. Call sites
  // that genuinely want a title block next to a right-aligned action
  // (e.g. a badge) should wrap their own `flex items-start justify-between
  // gap-3` row inside CardHeader rather than relying on this default.
  return <div className={cn('mb-4 flex flex-col gap-1', className)} {...props} />;
}
export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  // break-words so a long unbroken string (an email address, a filename)
  // wraps inside the card instead of overflowing it — the default
  // overflow-wrap only breaks at spaces, which those strings don't have.
  return <h3 className={cn('text-lg font-semibold tracking-tight break-words', className)} {...props} />;
}
export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-lipro-600/70 dark:text-lipro-200/60', className)} {...props} />;
}
export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-3', className)} {...props} />;
}
