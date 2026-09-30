'use client';
import { ArrowDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { decidirRolagem } from '@/lib/rolagem-lista';

/** Distância do fim (px) em que a pessoa ainda conta como "no fim da conversa". */
const PERTO_DO_FIM = 48;

/**
 * Lista de mensagens do assistente: abre rolada até a mais nova. Mensagem nova desce sozinha quando a pessoa
 * está no fim (ou acabou de perguntar); se ela rolou para cima para ler, a rolagem fica e aparece "Novas mensagens ↓".
 * Outras atualizações da página não mexem na rolagem de quem está lendo.
 * `ultima`: identifica o fim da lista (id da última mensagem e se está "Pensando…"); mudou = chegou algo novo.
 */
export function ListaRolante({ className, rotulo, ultima, children }: { className?: string; rotulo: string; ultima: string; children: ReactNode }) {
  const ref = useRef<HTMLUListElement>(null);
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

  useEffect(() => {
    const aoEnviar = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.closest('[data-compositor-assistente]')) enviouEm.current = Date.now();
    };
    document.addEventListener('submit', aoEnviar, true);
    return () => document.removeEventListener('submit', aoEnviar, true);
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <ul
        ref={ref}
        aria-label={rotulo}
        tabIndex={0}
        className={cn('relative flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto focus-visible:outline-2 focus-visible:outline-ring', className)}
        data-testid="mensagens-assistente"
        onScroll={(e) => {
          const el = e.currentTarget;
          noFim.current = el.scrollHeight - el.clientHeight - el.scrollTop < PERTO_DO_FIM;
          if (noFim.current && novas) setNovas(false);
        }}
      >
        {children}
      </ul>
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
