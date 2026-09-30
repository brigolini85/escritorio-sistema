'use client';

import { ArrowDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

/** Distância do fim (px) em que a pessoa ainda conta como "no fim da conversa". */
const PERTO_DO_FIM = 48;
/** Depois de enviar pelo compositor, a próxima mensagem que chegar desce a rolagem (a pessoa quer ver o que mandou). */
const JANELA_ENVIO_MS = 15_000;

/**
 * Histórico da conversa: abre rolado até a mensagem mais nova. Quando chegam mensagens pelo tempo real,
 * desce sozinho só se a pessoa estava no fim (ou acabou de enviar); se ela rolou para cima para ler,
 * a rolagem fica onde está e aparece "Novas mensagens ↓".
 * `quantidade`: itens do histórico (mensagens + notas); é o que diz se chegou algo novo.
 */
export function Historico({ quantidade, children }: { quantidade: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const conteudo = useRef<HTMLDivElement>(null);
  const anterior = useRef<number | null>(null);
  const noFim = useRef(true);
  const enviouEm = useRef(0);
  const [novas, setNovas] = useState(0);

  const descer = (suave = false) => {
    const el = ref.current;
    if (!el) return;
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ top: el.scrollHeight, behavior: suave && !reduzir ? 'smooth' : 'auto' });
    noFim.current = true;
    setNovas(0);
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const antes = anterior.current;
    anterior.current = quantidade;
    if (antes === null) {
      el.scrollTop = el.scrollHeight;
      return;
    }
    if (quantidade <= antes) return;
    if (noFim.current || Date.now() - enviouEm.current < JANELA_ENVIO_MS) {
      enviouEm.current = 0;
      descer();
    } else {
      setNovas((n) => n + quantidade - antes);
    }
  }, [quantidade]);

  // Conteúdo que cresce sem mensagem nova (fonte carregando, painel abrindo): quem está no fim continua no fim.
  useEffect(() => {
    const el = ref.current;
    const dentro = conteudo.current;
    if (!el || !dentro) return;
    const obs = new ResizeObserver(() => {
      if (noFim.current) el.scrollTop = el.scrollHeight;
    });
    obs.observe(dentro);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Envio pelo compositor (resposta ou nota): a mensagem que voltar do servidor deve aparecer.
  useEffect(() => {
    const aoEnviar = (e: Event) => {
      if (e.target instanceof HTMLElement && e.target.closest('[data-compositor]')) enviouEm.current = Date.now();
    };
    document.addEventListener('submit', aoEnviar, true);
    return () => document.removeEventListener('submit', aoEnviar, true);
  }, []);

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={ref}
        role="log"
        aria-label="Histórico da conversa"
        tabIndex={0}
        className="relative h-full overflow-y-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          noFim.current = el.scrollHeight - el.clientHeight - el.scrollTop < PERTO_DO_FIM;
          if (noFim.current && novas) setNovas(0);
        }}
      >
        <div ref={conteudo} className="flex flex-col gap-2 p-4">{children}</div>
      </div>
      {novas > 0 && (
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
