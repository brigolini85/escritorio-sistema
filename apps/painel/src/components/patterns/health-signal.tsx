'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { formatarDataHora, tempoRelativo } from '@/lib/formatos';
import { LIMITES_PADRAO, ROTULO_SITUACAO, situacaoDoSinal, type LimitesSinal, type SituacaoSinal } from '@/lib/sinal-vida';
import { useAgora } from './relative-time';

const COR: Record<SituacaoSinal, string> = {
  ok: 'bg-success',
  atrasado: 'bg-warning',
  parado: 'bg-danger',
  sem_sinal: 'bg-danger',
};
const TEXTO: Record<SituacaoSinal, string> = {
  ok: 'text-muted',
  atrasado: 'text-warning',
  parado: 'text-danger',
  sem_sinal: 'text-danger',
};

/**
 * Sinal de vida (WhatsApp, fila, trabalhador): ponto colorido + nome + "há 40s".
 * A situação também vai em texto (leitor de tela e tooltip), nunca só a cor. Recalcula a situação a cada 15s contra
 * `ultimoSinal`; trazer um `ultimoSinal` novo é da página (monte RecarregarPeriodico), senão ele vira "Parado" sozinho.
 */
export function HealthSignal({
  rotulo,
  ultimoSinal,
  limites = LIMITES_PADRAO,
  detalhe,
  className,
}: {
  rotulo: string;
  ultimoSinal: string | null;
  limites?: LimitesSinal;
  /** Linha extra do tooltip, ex.: "Z-API conectada ao número (31) 3222-1100". */
  detalhe?: string;
  className?: string;
}) {
  const agora = useAgora(15_000);
  const situacao = situacaoDoSinal(ultimoSinal, agora, limites);
  const quando = (ultimoSinal && tempoRelativo(ultimoSinal, agora)) || 'nenhum sinal';
  const completa = ultimoSinal ? formatarDataHora(ultimoSinal) : '';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={cn('inline-flex cursor-default items-center gap-2 rounded-sm text-left text-sm', className)}>
          <span aria-hidden className={cn('size-2 shrink-0 rounded-full', COR[situacao])} />
          <span className="font-medium text-foreground">{rotulo}</span>
          <span className={cn('tabular', TEXTO[situacao])} suppressHydrationWarning>
            {situacao === 'ok' && <span className="sr-only">{ROTULO_SITUACAO.ok}, </span>}
            {situacao === 'ok' ? quando : `${ROTULO_SITUACAO[situacao]} · ${quando}`}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{ROTULO_SITUACAO[situacao]}</p>
        <p>{completa ? `Último sinal: ${completa} (horário de Brasília)` : 'Nenhum sinal registrado.'}</p>
        {detalhe && <p>{detalhe}</p>}
      </TooltipContent>
    </Tooltip>
  );
}
