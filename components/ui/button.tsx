import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-lipro-600 to-lipro-500 text-white shadow-lg shadow-lipro-600/20 hover:brightness-110',
  ghost: 'bg-transparent text-lipro-700 dark:text-lipro-200 hover:bg-lipro-50 dark:hover:bg-lipro-950/40',
  outline: 'border border-lipro-300/40 text-lipro-700 dark:text-lipro-200 hover:bg-lipro-50 dark:hover:bg-lipro-950/40',
  danger: 'bg-red-500 text-white hover:bg-red-600',
};
const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button ref={ref} className={cn('inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed', variants[variant], sizes[size], className)} {...props} />
  )
);
Button.displayName = 'Button';
