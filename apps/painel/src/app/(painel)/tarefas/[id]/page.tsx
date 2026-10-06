import { SearchX } from 'lucide-react';
import { PageHeader } from '@/components/patterns/page-header';
import { EmptyState } from '@/components/patterns/empty-state';
import { Card } from '@/components/ui/card';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerPedidoDaTarefa, lerTarefa } from '@/lib/tarefas';
import { TEXTO_SETOR_INATIVO } from '@/lib/tarefas-tela';
import { AprovacaoTarefa } from './aprovacao-tarefa';
import { CabecalhoTarefa } from './cabecalho-tarefa';
import { EtapasTarefa } from './etapas-tarefa';
import { FontesTarefa } from './fontes-tarefa';
import { CustoTarefa, LinhaDoTempoTarefa, PedidoTarefa } from './lateral-tarefa';
import { PendenciasTarefa } from './pendencias-tarefa';
import { ResultadoTarefa } from './resultado-tarefa';

/** Parte I3a (spec 7E.4, D21): a tarefa do agente dentro da demanda. A RLS decide quem vê; as ações, o banco. */
export default async function PaginaTarefa({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, u] = await Promise.all([params, obterUsuario()]);
  const sb = await supabaseServidor();
  const [{ tarefa: t, semI3 }, pedido] = await Promise.all([lerTarefa(sb, id), lerPedidoDaTarefa(sb, id)]);
  if (semI3) {
    return <p className="rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">As tarefas aparecem quando a atualização do banco da Parte I3 for aplicada.</p>;
  }
  if (!t) return <EmptyState icone={SearchX} titulo="Não encontrei esta tarefa." descricao="Ela pode ser de um setor que você não atende." />;
  const setorInativo = t.setorAtivo === false;
  const podeMexer = !setorInativo && (u.papel === 'admin' || (t.setorId !== null && u.setores.includes(t.setorId)));
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        secao={`Nº ${t.demanda.numero} · ${t.setor ?? 'Triagem'}`}
        titulo={<>{t.demanda.titulo}{t.empresa ? <> · <span className="text-brand">{t.empresa.nome}</span></> : null}</>}
      />
      {setorInativo && <p role="status" className="rounded-md border border-warning bg-warning-soft px-4 py-3 text-sm text-warning">{TEXTO_SETOR_INATIVO}</p>}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="flex flex-col gap-6 border-t-4 border-t-brand p-4 lg:col-span-2" role="region" aria-label={`Tarefa do agente ${t.setor ?? ''}`.trim()}>
          <CabecalhoTarefa t={t} podeMexer={podeMexer} pediuPeloAssistente={pedido?.pediuPeloAssistente === true} />
          <EtapasTarefa t={t} />
          <FontesTarefa t={t} podeMexer={podeMexer} />
          <PendenciasTarefa t={t} podeMexer={podeMexer} />
          <ResultadoTarefa t={t} />
        </Card>
        <div className="flex flex-col gap-4">
          <AprovacaoTarefa t={t} podeMexer={podeMexer} setorInativo={setorInativo} />
          {pedido && <PedidoTarefa t={t} pedido={pedido} />}
          <CustoTarefa t={t} />
          <LinhaDoTempoTarefa t={t} />
        </div>
      </div>
    </div>
  );
}
