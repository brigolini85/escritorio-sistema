import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

// Selos sempre levam texto (nunca só cor). Cor de estado só com significado.
export const variantesSelo = cva(
  'inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-sm px-1.5 text-xs font-medium [&_svg]:size-3 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        neutral: 'bg-surface-muted text-muted',
        outline: 'border border-border text-muted',
        brand: 'bg-brand-soft text-brand',
        success: 'bg-success-soft text-success',
        warning: 'bg-warning-soft text-warning',
        danger: 'bg-danger-soft text-danger',
        info: 'bg-info-soft text-info',
        'agent-active': 'bg-agent-active-soft text-agent-active',
        'agent-paused': 'bg-agent-paused-soft text-agent-paused',
        'human-owned': 'bg-human-owned-soft text-human-owned',
        assistant: 'bg-assistant-soft text-assistant',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof variantesSelo>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(variantesSelo({ variant }), className)} {...props} />;
}
