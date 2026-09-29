import 'server-only';
import { pedidoVendaBling, problemasPedidoBling, type PedidoVendaBling, type PedidoVendaSalvo } from '@escritorio/core';
import type { supabaseServidor } from './supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/** Qual conjunto de demandas vira arquivo: uma demanda (botão da demanda) ou as abertas do filtro da tela Demandas. */
export type FiltroBling = { id: string } | { setor: string };

/**
 * Pedidos de venda das demandas, com o comprador lido do cadastro agora (CEP, número... preenchidos depois também valem).
 * O RLS dos chamados decide o que cada pessoa enxerga.
 */
export async function carregarPedidosBling(sb: Sb, filtro: FiltroBling): Promise<{ pedidos: PedidoVendaBling[]; problemas: string[] }> {
  let consulta = sb.from('chamados').select('numero, pedido_venda').not('pedido_venda', 'is', null).order('numero');
  if ('id' in filtro) consulta = consulta.eq('id', filtro.id);
  else {
    consulta = consulta.neq('status', 'concluido');
    if (filtro.setor === 'triagem') consulta = consulta.is('setor_id', null);
    else if (filtro.setor !== 'todos') consulta = consulta.eq('setor_id', filtro.setor);
  }
  const { data: chamados } = await consulta;
  const salvos = (chamados ?? []).map((c) => ({ numero: Number(c.numero), salvo: c.pedido_venda as unknown as PedidoVendaSalvo }));

  const ids = [...new Set(salvos.flatMap((s) => (s.salvo.unidade_id ? [s.salvo.unidade_id] : [])))];
  const { data: unidades } = ids.length
    ? await sb.from('parceiros_unidades').select('id, razao_social, nome_unidade, cnpj, endereco, numero, complemento, bairro, cidade, uf, cep, telefone').in('id', ids)
    : { data: [] };
  const porId = new Map((unidades ?? []).map((u) => [u.id, u]));

  const pedidos = salvos.map((s) => pedidoVendaBling(s.numero, s.salvo, s.salvo.unidade_id ? porId.get(s.salvo.unidade_id) ?? null : null));
  return { pedidos, problemas: pedidos.flatMap(problemasPedidoBling) };
}
