'use client';

import { Label as LabelPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export function Label({ className, ...props }: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'flex select-none items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand peer-disabled:cursor-not-allowed peer-disabled:opacity-50 has-disabled:cursor-not-allowed has-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
