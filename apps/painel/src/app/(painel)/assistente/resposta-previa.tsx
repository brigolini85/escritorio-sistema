'use client';

import { Check, LoaderCircle, PenLine } from 'lucide-react';
import { useEffect, useRef, type RefObject } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { textoAoMudar } from '@/lib/pedido-assistente';
import { preencherCampo, usarCampoPergunta } from './compositor-assistente';

/** O que SIM, GRAVAR escreve pela pessoa: o mesmo "sim" que ela digitaria (D6). */
export const RESPOSTA_SIM = 'sim';

/**
 * Botões embaixo da prévia (spec 7C.3). Só escrevem a resposta pela pessoa: o "sim" vai pela mesma ação do campo
 * (perguntarAoAssistente) e o trabalhador grava, como sempre, exatamente a prévia mostrada antes do "sim".
 */
export function RespostaDaPrevia({ acao }: { acao: (dados: FormData) => void | Promise<void> }) {
  const campo = usarCampoPergunta();
  const enviando = useRef(false);
  const gravou = useRef(false);
  // Depois do SIM os botões somem (a última mensagem passa a ser da pessoa): o foco vai para o campo, não para o <body>.
  useEffect(() => () => { if (gravou.current) campo?.current?.focus(); }, [campo]);
  return (
    <div role="group" aria-labelledby="titulo-resposta-previa" className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
      <p id="titulo-resposta-previa" className="w-full text-sm text-muted">Gravar esta prévia? Os botões só escrevem a resposta por você na conversa.</p>
      <form
        action={acao}
        onSubmit={(e) => {
          // Um clique, uma pergunta: outro envio antes de a ação terminar é barrado (como no campo).
          if (enviando.current) e.preventDefault();
          else { enviando.current = true; gravou.current = true; }
        }}
      >
        <input type="hidden" name="pergunta" value={RESPOSTA_SIM} />
        <BotaoSim enviando={enviando} />
      </form>
      <Button type="button" variant="outline" size="sm" onClick={() => { const el = campo?.current; if (el) preencherCampo(el, textoAoMudar(el.value)); }}>
        <PenLine aria-hidden size={16} strokeWidth={1.75} />
        Mudar outra coisa
      </Button>
    </div>
  );
}

function BotaoSim({ enviando }: { enviando: RefObject<boolean> }) {
  const { pending } = useFormStatus();
  useEffect(() => { if (!pending) enviando.current = false; }, [pending, enviando]);
  return (
    <Button type="submit" size="sm" disabled={pending} aria-busy={pending || undefined}>
      {pending ? <LoaderCircle aria-hidden size={16} strokeWidth={1.75} className="animate-spin" /> : <Check aria-hidden size={16} strokeWidth={1.75} />}
      Sim, gravar
    </Button>
  );
}
