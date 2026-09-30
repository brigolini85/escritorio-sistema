'use client';

import type { CSSProperties } from 'react';
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner';

export { toast };

// Cores dos avisos vêm dos tokens, então seguem o tema do painel (data-theme ou sistema) sem configuração.
const ESTILO = {
  '--normal-bg': 'var(--surface)',
  '--normal-text': 'var(--text)',
  '--normal-border': 'var(--border)',
  '--success-bg': 'var(--success-soft)',
  '--success-text': 'var(--success)',
  '--success-border': 'var(--success-soft)',
  '--error-bg': 'var(--danger-soft)',
  '--error-text': 'var(--danger)',
  '--error-border': 'var(--danger-soft)',
  '--warning-bg': 'var(--warning-soft)',
  '--warning-text': 'var(--warning)',
  '--warning-border': 'var(--warning-soft)',
  '--info-bg': 'var(--info-soft)',
  '--info-text': 'var(--info)',
  '--info-border': 'var(--info-soft)',
  '--border-radius': 'var(--radius-lg)',
} as CSSProperties;

/** Área dos avisos (toasts). Montar uma vez; disparar com toast('...'), toast.success, toast.error. */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      richColors
      closeButton
      style={ESTILO}
      toastOptions={{ classNames: { toast: 'font-sans text-base shadow-md', description: 'text-muted' } }}
      {...props}
    />
  );
}
