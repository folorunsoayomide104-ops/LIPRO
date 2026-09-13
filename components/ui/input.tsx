import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn('w-full rounded-lg bg-studio-elevated px-4 py-2.5 text-sm text-studio-fg shadow-studio-border outline-none transition-colors placeholder:text-studio-subtle', className)} {...props} />
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn('w-full rounded-lg bg-studio-elevated px-4 py-2.5 text-sm text-studio-fg shadow-studio-border outline-none transition-colors placeholder:text-studio-subtle min-h-32 resize-y', className)} {...props} />
  )
);
Textarea.displayName = 'Textarea';

export const Label = ({ className, children, htmlFor }: { className?: string; children: React.ReactNode; htmlFor?: string }) => (
  <label htmlFor={htmlFor} className={cn('mb-1.5 block text-xs font-medium uppercase tracking-wide text-studio-subtle', className)}>{children}</label>
);
