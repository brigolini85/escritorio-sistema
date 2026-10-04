import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge ajustado à escala tipográfica fechada (xs, sm, base, lg, xl, 2xl, 3xl, display) e ao utilitário "tabular".
const twMerge = extendTailwindMerge({
  override: { theme: { text: ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', 'display'] } },
  extend: { classGroups: { 'fvn-spacing': ['tabular'] } },
});

/** Junta classes condicionais e resolve conflitos do Tailwind (a última vence). */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
