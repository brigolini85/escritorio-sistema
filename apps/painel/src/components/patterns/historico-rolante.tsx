'use client';

import { ArrowDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject, type UIEvent } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { decidirRolagem, estaNoFim } from '@/lib/rolagem-lista';

/**
 * Lista de mensagens que acompanha a rolagem (histórico do Atendimento, conversa do Assistente).
 * Abre rolada até a mais nova. Quando chega algo novo (`ultima` mudou), desce sozinha só se a pessoa estava no fim
 * ou enviou pelo compositor há pouco (`JANELA_ENVIO_MS`); se ela rolou para cima para ler, a rolagem fica onde está
 * e aparece "Novas mensagens ↓". Outras atualizações da página não mexem na rolagem de quem está lendo.
 * A regra fica em `decidirRolagem` (lib/rolagem-lista.ts, com teste).
 *
 * - `ultima`: identifica o fim da lista (ex.: id da última mensagem); mudou = chegou algo novo.
 * - `compositor`: seletor CSS do formulário de envio desta lista (o envio abre a janela de descida).
 * - `como`: elemento que rola (`div` com `role="log"` ou `ul`, quando os filhos são `<li>`).
 */
export function HistoricoRolante({
  ultima,
  compositor,
  rotulo,
  como = 'div',
  role,
  className,
  classNameLista,
  testId,
  children,
}: {
  ultima: string;
  compositor: string;
  rotulo: string;
  como?: 'div' | 'ul';
  role?: 'log';
  className?: string;
  classNameLista?: string;
  testId?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const vista = useRef<string | null>(null);
  const noFim = useRef(true);
  const enviouEm = useRef(0);
  const [novas, setNovas] = useState(false);

  const descer = (suave = false) => {
    const el = ref.current;
    if (!el) return;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: suave && !reduzir ? 'smooth' : 'auto' });
    noFim.current = true;
    setNovas(false);
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const acao = decidirRolagem({ anterior: vista.current, ultima, noFim: noFim.current, desdeEnvioMs: Date.now() - enviouEm.current });
    vista.current = ultima;
    if (acao === 'inicio' || acao === 'manter-fim') el.scrollTop = el.scrollHeight;
    else if (acao === 'descer') descer();
    else if (acao === 'avisar') setNovas(true);
  });

  // Conteúdo que cresce sem mensagem nova (fonte carregando, painel abrindo): quem está no fim continua no fim.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      if (noFim.current) el.scrollTop = el.scrollHeight;
    });
    obs.observe(el);
    for (const filho of el.children) obs.observe(filho);
    return () => obs.disconnect();
  });

  // Envio pelo compositor: o que voltar do servidor logo em seguida deve aparecer.
  useEffect(() => {
    const aoEnviar = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.closest(compositor)) enviouEm.current = Date.now();
    };
    document.addEventListener('submit', aoEnviar, true);
    return () => document.removeEventListener('submit', aoEnviar, true);
  }, [compositor]);

  const props = {
    'aria-label': rotulo,
    role,
    tabIndex: 0,
    'data-testid': testId,
    className: cn('relative overflow-y-auto', classNameLista),
    onScroll: (e: UIEvent<HTMLElement>) => {
      noFim.current = estaNoFim(e.currentTarget);
      if (noFim.current && novas) setNovas(false);
    },
  };

  return (
    <div className={cn('relative', className)}>
      {como === 'ul' ? (
        <ul ref={ref as RefObject<HTMLUListElement>} {...props}>{children}</ul>
      ) : (
        <div ref={ref as RefObject<HTMLDivElement>} {...props}>{children}</div>
      )}
      {novas && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Button size="sm" className="pointer-events-auto rounded-full shadow-md" onClick={() => descer(true)}>
            Novas mensagens
            <ArrowDown aria-hidden size={16} strokeWidth={1.75} />
          </Button>
        </div>
      )}
    </div>
  );
}
