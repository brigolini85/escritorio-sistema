import { tarefaAtiva } from '@escritorio/core';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { formatarUSD } from '@/lib/formatos';
import { TEXTO_SETOR_INATIVO, algumPodePedir, textoDoEstado, type AgenteDeTrabalho, type ResumoTarefaDemanda } from '@/lib/tarefas-tela';
import { NovaTarefa } from './nova-tarefa';

/** D21: o bloco "Tarefa do agente <setor>" no painel lateral da demanda. D3: uma tarefa ativa por demanda; F10: setor desativado não cria. */
export function TarefaNaDemanda({ chamadoId, resumo, agentes, podePedir, setorInativo = false }: {
  chamadoId: string; resumo: ResumoTarefaDemanda | null; agentes: AgenteDeTrabalho[]; podePedir: boolean; setorInativo?: boolean;
}) {
  const ativa = !!resumo && tarefaAtiva(resumo.estado);
  return (
    <div className="flex flex-col gap-2 text-sm">
      {resumo && (
        <div className="flex flex-col gap-1 rounded-md border border-border p-3">
          <p className="flex flex-wrap items-center gap-2"><Badge variant={resumo.estado === 'aprovada' ? 'success' : 'warning'}>{textoDoEstado(resumo)}</Badge>
            <span className="text-muted">{resumo.agente}{resumo.etapa ? ` · ${resumo.etapa}` : ''}</span></p>
          {resumo.abertas > 0 && <p>{resumo.abertas} pendência{resumo.abertas > 1 ? 's' : ''} aberta{resumo.abertas > 1 ? 's' : ''}</p>}
          <p className="text-xs text-muted">Custo: {formatarUSD(resumo.custoUsd)}</p>
          <Link href={`/tarefas/${resumo.id}`} className={variantesBotao({ variant: 'link' })}>Abrir a tarefa</Link>
        </div>
      )}
      {setorInativo && !ativa && <p className="text-xs text-warning">{TEXTO_SETOR_INATIVO}</p>}
      {!ativa && !setorInativo && podePedir && algumPodePedir(agentes) && <NovaTarefa chamadoId={chamadoId} agentes={agentes} />}
    </div>
  );
}
