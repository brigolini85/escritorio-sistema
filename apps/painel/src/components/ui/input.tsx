import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full min-w-0 rounded-md border border-input bg-surface px-3 text-base text-foreground shadow-sm transition-colors duration-150 ease-out placeholder:text-subtle',
        'file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60 aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}
