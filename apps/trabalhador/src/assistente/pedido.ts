import type { PedidoVendaSalvo } from '@escritorio/core';
import type { ProdutoEmpresa, UnidadeParceiro } from '@escritorio/db';
import { formatarReais, montarPedidoVenda, type ItemPedido } from '../agente/pedido-nota';
import { totalDoPedido } from './vendas';

export type ItemCorrecao = { produto_id: string | null; texto: string; quantidade: number; unidade: string; valor_unitario?: number | null };

/** Pedido corrigido: itens novos com o preço da tabela (ou o valor informado), o combinado alterado e a data original mantida. */
export function corrigirPedido(p: {
  salvo: PedidoVendaSalvo; destino: UnidadeParceiro | null; itens: ItemCorrecao[] | null; produtos: ProdutoEmpresa[];
  precos: Record<string, number>; extras: Partial<PedidoVendaSalvo>; agora: Date;
}): { novo: PedidoVendaSalvo; itensPedido: ItemPedido[] | null } {
  let itensVenda = p.salvo.itens;
  let itensPedido: ItemPedido[] | null = null;
  if (p.itens) {
    itensPedido = p.itens.map((i): ItemPedido => {
      const produto = p.produtos.find((x) => x.id === i.produto_id) ?? null;
      // Valor informado pela equipe: vale como está, na unidade informada.
      if (i.valor_unitario != null) return { produto, texto: i.texto, quantidade: i.quantidade, unidade: i.unidade.trim().toUpperCase() || produto?.unidade || 'UN', preco: i.valor_unitario, precoInformado: true };
      return { produto, texto: i.texto, quantidade: i.quantidade, unidade: i.unidade, preco: produto ? p.precos[produto.id] ?? null : null };
    });
    itensVenda = montarPedidoVenda({ agora: p.agora, destino: p.destino, textoDestinatario: p.salvo.texto_destinatario, itens: itensPedido, extras: {} }).itens;
  }
  const novo: PedidoVendaSalvo = { ...p.salvo, ...p.extras, itens: itensVenda, data: p.salvo.data };
  return { novo, itensPedido };
}

const FRETE = { R: 'por conta de quem vende', D: 'por conta do destinatário' } as const;

/** Descreve tudo o que a correção pode mudar; com `destinatario`, começa por ele. */
export function descreverPedido(p: PedidoVendaSalvo, destinatario?: string | null): string {
  const linhas = p.itens.map((i) => {
    const base = `• ${String(i.quantidade ?? '?').replace('.', ',')} ${i.un ?? 'UN'} ${i.produto ?? ''}${i.sku ? ` (cód. ${i.sku})` : ''}`;
    return i.valor_unitario !== null && i.quantidade !== null
      ? `${base} × ${formatarReais(i.valor_unitario)} = ${formatarReais(Math.round(i.quantidade * i.valor_unitario * 100) / 100)}`
      : `${base} – sem preço`;
  });
  const combinado = [p.forma_pagamento ? `Pagamento: ${p.forma_pagamento}` : '', p.data_prevista ? `Entrega: ${p.data_prevista}` : '',
    p.valor_frete ? `Frete: ${formatarReais(p.valor_frete)}` : ''].filter(Boolean).join(' · ');
  return [...(destinatario !== undefined ? [`Destinatário: ${destinatario ?? p.texto_destinatario}`] : []), ...linhas, `Total: ${formatarReais(totalDoPedido(p))}`,
    ...(combinado ? [combinado] : []), ...(p.tipo_frete ? [`Tipo de frete: ${FRETE[p.tipo_frete]}`] : []),
    ...(p.transportadora ? [`Transportadora: ${p.transportadora}`] : []), ...(p.observacoes ? [`Observações: ${p.observacoes}`] : [])].join('\n');
}

export function pedidoOriginalDoResumo(resumo: string): string {
  return /Pedido original: "([\s\S]*)"\s*$/.exec(resumo)?.[1] ?? '';
}
