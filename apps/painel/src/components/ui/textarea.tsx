import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-20 w-full rounded-md border border-input bg-surface px-3 py-2 text-base text-foreground shadow-sm transition-colors duration-150 ease-out placeholder:text-subtle',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}
