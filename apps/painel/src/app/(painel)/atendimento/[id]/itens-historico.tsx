import { Flag, Info } from 'lucide-react';
import type { CartaoDecisao, DecisaoBruta } from '@/lib/conversa-itens';
import { resumoPorQue } from '@/lib/conversa-itens';
import { camposLegiveis, rotuloEtapa } from '@/lib/decisoes';
import { formatarHora } from '@/lib/formatos';
import { CamposDecisao } from './campos-decisao';

/** Marco centralizado (spec 7A.1): "Demanda #1042 aberta no Fiscal · urgente", "Ana assumiu", "Devolvido ao agente". */
export function MarcoConversa({ texto, criadoEm }: { texto: string; criadoEm: string }) {
  return (
    <p className="mx-auto flex max-w-full items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-center text-xs text-muted">
      <Flag aria-hidden size={14} strokeWidth={1.75} className="shrink-0" />
      <span>{texto}</span>
      <span aria-hidden>·</span>
      <time dateTime={criadoEm} className="tabular">{formatarHora(criadoEm)}</time>
    </p>
  );
}

/** Cartão de decisão (tracejado): o que o agente fez de importante neste turno. Alvo do "Ver decisão". */
export function CartaoDecisaoConversa({ cartao }: { cartao: CartaoDecisao }) {
  return (
    <div id={`turno-${cartao.turno}`} tabIndex={-1} className="ml-auto flex max-w-3/4 scroll-mt-16 flex-col gap-0.5 rounded-lg border border-dashed border-agent-active px-3 py-2 text-sm focus:outline-2 focus:outline-ring">
      <p className="font-semibold text-foreground">Decisão do agente · <time dateTime={cartao.criado_em} className="tabular">{formatarHora(cartao.criado_em)}</time></p>
      <p className="text-muted">{cartao.linha}</p>
    </div>
  );
}

/** "por quê?" de uma resposta do agente: as ferramentas do turno, com o que recebeu e o resultado. */
export function PorQue({ decisoes }: { decisoes: DecisaoBruta[] }) {
  return (
    <details className="group text-xs">
      <summary className="flex cursor-pointer items-center gap-1 font-medium text-agent-active">
        <Info aria-hidden size={14} strokeWidth={1.75} />
        <span>por quê?</span>
        <span className="font-normal text-muted">{resumoPorQue(decisoes)}</span>
      </summary>
      <ol className="mt-1 flex flex-col gap-1.5 border-l border-border pl-2">
        {decisoes.map((d) => (
          <li key={d.id} className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">{rotuloEtapa(d.etapa)}</span>
            <CamposDecisao titulo="Recebeu" campos={camposLegiveis(d.entrada)} />
            <CamposDecisao titulo="Resultado" campos={camposLegiveis(d.saida)} />
          </li>
        ))}
      </ol>
    </details>
  );
}
