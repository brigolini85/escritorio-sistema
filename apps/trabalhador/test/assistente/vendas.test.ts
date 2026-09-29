import { describe, expect, it } from 'vitest';
import type { PedidoVendaSalvo } from '@escritorio/core';
import { periodoEmIso, totaisDeVendas, totalDoPedido } from '../../src/assistente/vendas';

const pedido = (itens: [number, number | null][], frete: number | null = null): PedidoVendaSalvo => ({
  unidade_id: 'u1', texto_destinatario: 'x', data: '29/09/2026', data_prevista: null, forma_pagamento: null, valor_frete: frete,
  tipo_frete: null, transportadora: null, observacoes: null, entrega: null,
  itens: itens.map(([quantidade, valor_unitario]) => ({ produto: 'P', sku: '1', un: 'PAC', quantidade, valor_unitario })),
});

describe('vendas (assistente, 2026-09-29)', () => {
  it('período de Brasília em ISO; "até" inclui o dia inteiro', () => {
    expect(periodoEmIso('01/09/2026', '30/09/2026')).toEqual({ de: '2026-09-01T00:00:00-03:00', ate: '2026-09-30T23:59:59-03:00' });
    expect(periodoEmIso()).toEqual({});
  });
  it('total do pedido soma itens com preço e o frete', () => {
    expect(totalDoPedido(pedido([[10, 9.5], [2, null]], 15))).toBe(110);
  });
  it('totais por rede, maior primeiro', () => {
    expect(totaisDeVendas([
      { salvo: pedido([[10, 9.5]]), rede: 'Supermercado Brasil' },
      { salvo: pedido([[1, 100]]), rede: 'Hortsul' },
      { salvo: pedido([[5, 9.5]]), rede: 'Supermercado Brasil' },
    ])).toEqual({ pedidos: 3, total: 242.5, porRede: [{ rede: 'Supermercado Brasil', pedidos: 2, total: 142.5 }, { rede: 'Hortsul', pedidos: 1, total: 100 }] });
  });
});
