import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn('w-full rounded-xl border border-lipro-200/60 bg-white/70 px-4 py-2.5 text-sm outline-none transition-all placeholder:text-lipro-300/70 focus:border-lipro-400 focus:ring-4 focus:ring-lipro-400/15 dark:bg-surface-dark/60 dark:border-lipro-700/40 dark:placeholder:text-lipro-300/40', className)} {...props} />
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn('w-full rounded-xl border border-lipro-200/60 bg-white/70 px-4 py-2.5 text-sm outline-none transition-all placeholder:text-lipro-300/70 focus:border-lipro-400 focus:ring-4 focus:ring-lipro-400/15 dark:bg-surface-dark/60 dark:border-lipro-700/40 dark:placeholder:text-lipro-300/40 min-h-32 resize-y', className)} {...props} />
  )
);
Textarea.displayName = 'Textarea';

export const Label = ({ className, children, htmlFor }: { className?: string; children: React.ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className={cn('mb-1.5 block text-xs font-medium uppercase tracking-wide text-lipro-700/80 dark:text-lipro-200/80', className)}>{children}</label>
);
