import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export const variantesBotao = cva(
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-base font-bold tracking-wide transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'uppercase bg-brand text-brand-foreground hover:bg-brand/90',
        secondary: 'uppercase bg-surface-muted text-foreground hover:bg-border',
        outline: 'uppercase border border-input bg-surface text-foreground hover:bg-surface-muted',
        grafite: 'uppercase bg-grafite text-grafite-foreground hover:bg-grafite/90',
        success: 'uppercase bg-success text-success-foreground hover:bg-success/90',
        ghost: 'text-foreground hover:bg-surface-muted',
        danger: 'uppercase bg-danger text-danger-foreground hover:bg-danger/90',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-9 px-4',
        icon: 'size-9',
      },
    },
    compoundVariants: [{ variant: 'link', class: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof variantesBotao> & { asChild?: boolean };

/** Botão do sistema. Botão só de ícone (size="icon") precisa de aria-label. */
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp className={cn(variantesBotao({ variant, size }), className)} {...props} />;
}
