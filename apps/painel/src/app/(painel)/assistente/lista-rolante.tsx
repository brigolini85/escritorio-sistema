'use client';
import { useEffect, useRef, type ReactNode } from 'react';

/** Distância do fim (px) em que a pessoa ainda conta como "no fim da conversa". */
const PERTO_DO_FIM = 48;

/**
 * Lista de mensagens que abre rolada até a mais nova e desce sozinha quando chega mensagem nova
 * ou quando a pessoa já estava no fim. Outras atualizações da página não mexem na rolagem de quem está lendo.
 */
export function ListaRolante({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
  const quantidade = useRef(-1);
  const noFim = useRef(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const nova = el.children.length !== quantidade.current;
    quantidade.current = el.children.length;
    if (nova || noFim.current) el.scrollTop = el.scrollHeight;
  });
  return (
    <ul
      ref={ref}
      className={className}
      data-testid="mensagens-assistente"
      onScroll={(e) => {
        const el = e.currentTarget;
        noFim.current = el.scrollHeight - el.clientHeight - el.scrollTop < PERTO_DO_FIM;
      }}
    >
      {children}
    </ul>
  );
}
