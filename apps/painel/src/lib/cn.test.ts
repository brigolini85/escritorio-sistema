import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('junta classes condicionais', () => {
    expect(cn('px-2', false && 'hidden', null, undefined, { 'font-semibold': true, italic: false })).toBe('px-2 font-semibold');
  });

  it('a última classe conflitante vence', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    expect(cn('rounded-sm', 'rounded-lg')).toBe('rounded-lg');
  });

  it('tamanho de texto da escala e cor de texto do token não se anulam', () => {
    expect(cn('text-sm', 'text-muted')).toBe('text-sm text-muted');
    expect(cn('text-muted text-xs', 'text-foreground text-2xl')).toBe('text-foreground text-2xl');
    expect(cn('text-sm', 'text-base')).toBe('text-base');
  });

  it('cores de token do mesmo tipo se substituem', () => {
    expect(cn('bg-brand text-brand-foreground', 'bg-danger')).toBe('text-brand-foreground bg-danger');
    expect(cn('border-border', 'border-input')).toBe('border-input');
    expect(cn('bg-surface', 'bg-agent-paused-soft')).toBe('bg-agent-paused-soft');
  });

  it('tabular conflita com proportional-nums', () => {
    expect(cn('proportional-nums', 'tabular')).toBe('tabular');
  });
});
