'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** Lista de mensagens que abre e continua rolada até a mais nova (a cada atualização da conversa). */
export function ListaRolante({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  });
  return <ul ref={ref} className={className} data-testid="mensagens-assistente">{children}</ul>;
}
