import { tarefaAtiva } from '@escritorio/core';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { formatarUSD } from '@/lib/formatos';
import type { DadosPedir } from '@/lib/pedir-agente-tela';
import { TEXTO_SETOR_INATIVO, textoDoEstado, type ResumoTarefaDemanda } from '@/lib/tarefas-tela';
import type { EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { PedirAoAgente } from './pedir-ao-agente';

/** D21: o bloco "Tarefa do agente <setor>" no painel lateral da demanda. D3/D6: com tarefa ativa o botão segue (a tarefa nasce em demanda nova); F10: setor desativado não cria. */
export function TarefaNaDemanda({ chamado, resumo, pedir, podePedir, setorInativo = false, empresas, drive }: {
  chamado: { id: string; numero: number; empresa: { id: string; nome: string } | null }; resumo: ResumoTarefaDemanda | null; pedir: DadosPedir; podePedir: boolean;
  setorInativo?: boolean; empresas?: EmpresaOpcao[]; drive?: { pasta: boolean; configurado: boolean; erro?: boolean };
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
      {!setorInativo && podePedir && pedir.agentes.length > 0 && (!ativa || pedir.i4) && <PedirAoAgente chamado={chamado} dados={pedir} empresas={empresas} drive={drive} />}
    </div>
  );
}
