import 'server-only';
import { pedidoVendaBling, problemasPedidoBling, type PedidoVendaBling, type PedidoVendaSalvo } from '@escritorio/core';
import type { supabaseServidor } from './supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/** Qual conjunto de demandas vira arquivo: uma demanda (botão da demanda), várias (link do assistente) ou as abertas do filtro da tela Demandas. */
export type FiltroBling = { id: string } | { ids: string[] } | { setor: string };

/**
 * Pedidos de venda das demandas, com o comprador lido do cadastro agora (CEP, número... preenchidos depois também valem).
 * O RLS dos chamados decide o que cada pessoa enxerga.
 */
export async function carregarPedidosBling(sb: Sb, filtro: FiltroBling): Promise<{ pedidos: PedidoVendaBling[]; problemas: string[] }> {
  const base = () => sb.from('chamados').select('numero, pedido_venda').not('pedido_venda', 'is', null).order('numero');
  let linhas: { numero: number | string; pedido_venda: unknown }[];
  if ('ids' in filtro) {
    // Em blocos de 100: o filtro vai na URL e uma lista longa estoura o limite dela.
    linhas = [];
    const ids = [...new Set(filtro.ids)];
    for (let i = 0; i < ids.length; i += 100) linhas.push(...((await base().in('id', ids.slice(i, i + 100))).data ?? []));
    linhas.sort((a, b) => Number(a.numero) - Number(b.numero));
  } else {
    let consulta = base();
    if ('id' in filtro) consulta = consulta.eq('id', filtro.id);
    else {
      consulta = consulta.neq('status', 'concluido');
      if (filtro.setor === 'triagem') consulta = consulta.is('setor_id', null);
      else if (filtro.setor !== 'todos') consulta = consulta.eq('setor_id', filtro.setor);
    }
    linhas = (await consulta).data ?? [];
  }
  const salvos = linhas.map((c) => ({ numero: Number(c.numero), salvo: c.pedido_venda as unknown as PedidoVendaSalvo }));

  const ids = [...new Set(salvos.flatMap((s) => (s.salvo.unidade_id ? [s.salvo.unidade_id] : [])))];
  const unidades: NonNullable<Awaited<ReturnType<typeof buscarUnidades>>> = [];
  for (let i = 0; i < ids.length; i += 100) unidades.push(...((await buscarUnidades(sb, ids.slice(i, i + 100))) ?? []));
  const porId = new Map(unidades.map((u) => [u.id, u]));

  const pedidos = salvos.map((s) => pedidoVendaBling(s.numero, s.salvo, s.salvo.unidade_id ? porId.get(s.salvo.unidade_id) ?? null : null));
  return { pedidos, problemas: pedidos.flatMap(problemasPedidoBling) };
}

const buscarUnidades = async (sb: Sb, ids: string[]) =>
  (await sb.from('parceiros_unidades').select('id, razao_social, nome_unidade, cnpj, endereco, numero, complemento, bairro, cidade, uf, cep, telefone').in('id', ids)).data;
