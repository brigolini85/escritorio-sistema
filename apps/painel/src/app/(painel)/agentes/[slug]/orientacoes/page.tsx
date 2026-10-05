import { notFound } from 'next/navigation';
import { lerAgente, podeTreinarAgente } from '@/lib/agentes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import type { ParamsBusca } from '@/lib/tabela-url';
import { SemPermissao, TelaOrientacoes } from '../../../treinar-agente/tela-orientacoes';

/** Aba Orientações (spec 7E.1, 7C.5, D21): a tela do Treinar o agente, só com as orientações deste agente. */
export default async function OrientacoesDoAgente({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ParamsBusca> }) {
  const [{ slug }, busca, u] = await Promise.all([params, searchParams, obterUsuario()]);
  const sb = await supabaseServidor();
  const { agente, semMigracao } = await lerAgente(sb, slug);
  if (!agente) notFound();
  if (!podeTreinarAgente(u, agente)) {
    return <SemPermissao descricao={agente.portaDeEntrada ? undefined
      : `Só quem tem "Treinar o agente" e é do setor ${agente.setor ?? 'do agente'} muda estas orientações.`} />;
  }
  return <TelaOrientacoes params={busca} base={`/agentes/${agente.slug}/orientacoes`} agenteId={semMigracao ? null : agente.id} comSimulador={agente.portaDeEntrada} />;
}
