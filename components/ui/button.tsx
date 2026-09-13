import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary: 'bg-studio-primary text-studio-primary-fg shadow-studio-border hover:brightness-110',
  ghost: 'bg-transparent text-studio-muted hover:bg-studio-elevated hover:text-studio-fg',
  outline: 'border border-studio-border-strong text-studio-muted hover:bg-studio-elevated hover:text-studio-fg',
  danger: 'bg-studio-danger text-white hover:brightness-110',
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
