import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

/** Bloco de carregamento no formato do conteúdo real (nada de spinner no meio da página). */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-muted', className)} {...props} />;
}
