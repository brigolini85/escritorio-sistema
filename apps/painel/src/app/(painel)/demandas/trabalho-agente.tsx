import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { ROTULO_SITUACAO_PRE_ANALISE, resumoPreAnalise, type SituacaoPreAnalise } from '@escritorio/core';
import { RelativeTime } from '@/components/patterns/relative-time';
import { Badge } from '@/components/ui/badge';
import type { TrabalhoDoAgente } from '@/lib/agente-demanda';
import { BotoesSugestao } from './botoes-sugestao';

const ICONE = { falta: CircleAlert, atencao: TriangleAlert, ok: CircleCheck } as const;
const COR: Record<SituacaoPreAnalise, string> = { falta: 'text-danger', atencao: 'text-warning', ok: 'text-success' };
const ESTADO = { aguardando: 'Aguardando aprovação', aprovada: 'Aprovada', descartada: 'Descartada' } as const;

/** O que o agente do setor fez na demanda (D9, D19): a pré-análise e as sugestões. Vermelho nunca sozinho: ícone e a palavra. */
export function TrabalhoAgente({ trabalho, podeDecidir }: { trabalho: TrabalhoDoAgente; podeDecidir: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {trabalho.preAnalise && (
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold">Pré-análise do pedido · <span className="font-normal text-muted">{resumoPreAnalise(trabalho.preAnalise)}</span></p>
          <ul className="flex flex-col gap-1" aria-label="Pré-análise do pedido de nota">
            {trabalho.preAnalise.linhas.map((l, i) => {
              const Icone = ICONE[l.situacao];
              return (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Icone aria-hidden size={16} className={`mt-0.5 shrink-0 ${COR[l.situacao]}`} />
                  <span><b className={COR[l.situacao]}>{ROTULO_SITUACAO_PRE_ANALISE[l.situacao]}:</b> {l.texto}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {trabalho.sugestoes.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Sugestões do agente">
          {trabalho.sugestoes.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={s.estado === 'aguardando' ? 'warning' : s.estado === 'aprovada' ? 'success' : 'neutral'}>{ESTADO[s.estado]}</Badge>
                <span className="text-muted">{s.tipo === 'nota_interna' ? 'Nota interna' : 'Correção'} · {s.agente} · <RelativeTime data={s.criadaEm} /></span>
              </div>
              <p>{s.texto}</p>
              {s.estado !== 'aguardando' && s.decididaPor && <p className="text-xs text-muted">Decidida por {s.decididaPor}.</p>}
              {s.estado === 'aguardando' && podeDecidir && <BotoesSugestao id={s.id} />}
              {s.estado === 'aguardando' && !podeDecidir && <p className="text-xs text-muted">Quem aprova é uma pessoa do setor da demanda.</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
