import type { ItemVendaBling, PedidoVendaSalvo } from '@escritorio/core';
import type { ProdutoEmpresa, UnidadeParceiro } from '@escritorio/db';
import { formatarReais, montarPedidoVenda, type ItemPedido } from '../agente/pedido-nota';
import { totalDoPedido } from './vendas';

export type ItemCorrecao = { produto_id: string | null; texto: string; quantidade: number; unidade: string; valor_unitario?: number | null };

/** Pedido corrigido: itens novos com o preço da tabela (ou o valor informado), o combinado alterado e a data original mantida. */
export function corrigirPedido(p: {
  salvo: PedidoVendaSalvo; destino: UnidadeParceiro | null; itens: ItemCorrecao[] | null; produtos: ProdutoEmpresa[];
  precos: Record<string, number>; extras: Partial<PedidoVendaSalvo>; agora: Date;
}): { novo: PedidoVendaSalvo; itensPedido: ItemPedido[] | null } {
  let itensVenda: ItemVendaBling[] = p.salvo.itens;
  let itensPedido: ItemPedido[] | null = null;
  if (p.itens) {
    itensPedido = [];
    itensVenda = [];
    for (const i of p.itens) {
      const produto = p.produtos.find((x) => x.id === i.produto_id) ?? null;
      if (i.valor_unitario != null) {
        // Valor informado pela equipe: vale como está, na unidade informada.
        itensPedido.push({ produto, texto: i.texto, quantidade: i.quantidade, unidade: produto?.unidade ?? i.unidade, preco: i.valor_unitario });
        itensVenda.push({ produto: produto?.descricao ?? i.texto, sku: produto?.codigo ?? null, un: i.unidade.trim().toUpperCase() || 'UN', quantidade: i.quantidade, valor_unitario: i.valor_unitario });
      } else {
        const item: ItemPedido = { produto, texto: i.texto, quantidade: i.quantidade, unidade: i.unidade, preco: produto ? p.precos[produto.id] ?? null : null };
        itensPedido.push(item);
        itensVenda.push(...montarPedidoVenda({ agora: p.agora, destino: p.destino, textoDestinatario: p.salvo.texto_destinatario, itens: [item], extras: {} }).itens);
      }
    }
  }
  const novo: PedidoVendaSalvo = { ...p.salvo, ...p.extras, itens: itensVenda, data: p.salvo.data };
  return { novo, itensPedido };
}

export function descreverPedido(p: PedidoVendaSalvo): string {
  const linhas = p.itens.map((i) => {
    const base = `• ${String(i.quantidade ?? '?').replace('.', ',')} ${i.un ?? 'UN'} ${i.produto ?? ''}${i.sku ? ` (cód. ${i.sku})` : ''}`;
    return i.valor_unitario !== null && i.quantidade !== null
      ? `${base} × ${formatarReais(i.valor_unitario)} = ${formatarReais(Math.round(i.quantidade * i.valor_unitario * 100) / 100)}`
      : `${base} – sem preço`;
  });
  const combinado = [p.forma_pagamento ? `Pagamento: ${p.forma_pagamento}` : '', p.data_prevista ? `Entrega: ${p.data_prevista}` : '',
    p.valor_frete ? `Frete: ${formatarReais(p.valor_frete)}` : ''].filter(Boolean).join(' · ');
  return [...linhas, `Total: ${formatarReais(totalDoPedido(p))}`, ...(combinado ? [combinado] : [])].join('\n');
}

export function pedidoOriginalDoResumo(resumo: string): string {
  return /Pedido original: "([\s\S]*)"\s*$/.exec(resumo)?.[1] ?? '';
}
