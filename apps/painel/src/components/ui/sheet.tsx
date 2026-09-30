'use client';

import { X } from 'lucide-react';
import { Dialog as SheetPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
export const SheetClose = SheetPrimitive.Close;

/** Painel lateral (gaveta). Usa o Dialog do Radix: prende o foco e fecha com Esc. */
export function SheetContent({
  className,
  children,
  side = 'right',
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & { side?: 'right' | 'left' }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-aparecer data-[state=closed]:animate-desaparecer" />
      <SheetPrimitive.Content
        className={cn(
          'fixed inset-y-0 z-50 flex h-full w-3/4 flex-col gap-4 bg-surface text-foreground shadow-md sm:max-w-md',
          side === 'right'
            ? 'right-0 border-l border-border data-[state=open]:animate-deslizar-direita data-[state=closed]:animate-desaparecer'
            : 'left-0 border-r border-border data-[state=open]:animate-deslizar-esquerda data-[state=closed]:animate-desaparecer',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground">
          <X aria-hidden size={16} strokeWidth={1.75} />
          <span className="sr-only">Fechar</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 border-b border-border p-4 pr-12', className)} {...props} />;
}

export function SheetBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex-1 overflow-y-auto px-4', className)} {...props} />;
}

export function SheetFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('mt-auto flex justify-end gap-2 border-t border-border p-4', className)} {...props} />;
}

export function SheetTitle({ className, ...props }: ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn('text-lg font-semibold text-foreground', className)} {...props} />;
}

export function SheetDescription({ className, ...props }: ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn('text-base text-muted', className)} {...props} />;
}
