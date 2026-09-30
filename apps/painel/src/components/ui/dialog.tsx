'use client';

import { X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({ className, ...props }: ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-50 bg-overlay data-[state=open]:animate-aparecer data-[state=closed]:animate-desaparecer', className)}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  mostrarFechar = true,
  ...props
}: ComponentProps<typeof DialogPrimitive.Content> & { mostrarFechar?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid w-11/12 max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border border-border bg-surface p-6 text-foreground shadow-md',
          'data-[state=open]:animate-surgir data-[state=closed]:animate-sumir',
          className,
        )}
        {...props}
      >
        {children}
        {mostrarFechar && (
          <DialogPrimitive.Close className="absolute right-4 top-4 inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-muted transition-colors duration-150 ease-out hover:bg-surface-muted hover:text-foreground">
            <X aria-hidden size={16} strokeWidth={1.75} />
            <span className="sr-only">Fechar</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 pr-8', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn('text-lg font-semibold text-foreground', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn('text-base text-muted', className)} {...props} />;
}
