import { describe, expect, it } from 'vitest';
import type { PedidoVendaSalvo } from '@escritorio/core';
import type { ProdutoEmpresa } from '@escritorio/db';
import { corrigirPedido, descreverPedido, pedidoOriginalDoResumo } from '../../src/assistente/pedido';

const costela: ProdutoEmpresa = { id: 'p1', codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC', apelidos: [] };
const salvo: PedidoVendaSalvo = {
  unidade_id: 'u1', texto_destinatario: 'Brasil', data: '29/09/2026', data_prevista: null, forma_pagamento: 'PIX', valor_frete: null,
  tipo_frete: null, transportadora: null, observacoes: null, entrega: null,
  itens: [{ produto: 'Costela com Requeijão', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 9.5 }],
};

describe('corrigir pedido (assistente, 2026-09-29)', () => {
  it('troca a quantidade usando o preço da tabela e mantém a data e o resto do pedido', () => {
    const r = corrigirPedido({ salvo, destino: null, produtos: [costela], precos: { p1: 9.5 }, extras: {}, agora: new Date('2026-10-01T12:00:00Z'),
      itens: [{ produto_id: 'p1', texto: 'costela', quantidade: 15, unidade: 'PAC' }] });
    expect(r.novo).toEqual({ ...salvo, itens: [{ produto: 'Costela com Requeijão', sku: '12', un: 'PAC', quantidade: 15, valor_unitario: 9.5 }] });
  });
  it('valor informado vale sobre a tabela, mesmo em outra unidade', () => {
    const r = corrigirPedido({ salvo, destino: null, produtos: [costela], precos: { p1: 9.5 }, extras: {}, agora: new Date(),
      itens: [{ produto_id: 'p1', texto: 'costela', quantidade: 3, unidade: 'kg', valor_unitario: 30 }] });
    expect(r.novo.itens).toEqual([{ produto: 'Costela com Requeijão', sku: '12', un: 'KG', quantidade: 3, valor_unitario: 30 }]);
  });
  it('sem itens novos, só muda o combinado', () => {
    const r = corrigirPedido({ salvo, destino: null, produtos: [], precos: {}, extras: { forma_pagamento: 'Boleto', data_prevista: '02/10/2026' }, agora: new Date(), itens: null });
    expect(r.novo).toEqual({ ...salvo, forma_pagamento: 'Boleto', data_prevista: '02/10/2026' });
    expect(r.itensPedido).toBeNull();
  });
  it('descreve o pedido com total', () => {
    expect(descreverPedido(salvo)).toBe('• 10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00\nTotal: R$ 95,00\nPagamento: PIX');
  });
  it('descreve destinatário, tipo de frete, transportadora e observações', () => {
    const d = descreverPedido({ ...salvo, tipo_frete: 'R', transportadora: 'T', observacoes: 'O' }, 'Brasil / Santa Efigênia');
    expect(d.startsWith('Destinatário: Brasil / Santa Efigênia\n')).toBe(true);
    expect(d).toContain('Tipo de frete: por conta de quem vende');
    expect(d).toContain('Transportadora: T');
    expect(d).toContain('Observações: O');
  });
  it('mostra o endereço de entrega quando há um (revisão final, H)', () => {
    const entrega = { endereco: 'Rua das Flores', numero: '10', complemento: null, bairro: 'Centro', cidade: 'Contagem', uf: 'MG', cep: '32000000' };
    expect(descreverPedido({ ...salvo, entrega }, 'Brasil / Santa Efigênia').split('\n').slice(0, 2))
      .toEqual(['Destinatário: Brasil / Santa Efigênia', 'Entrega em: Rua das Flores, 10 – Centro – Contagem/MG – CEP 32000-000']);
    expect(descreverPedido(salvo)).not.toContain('Entrega em');
  });
  it('recupera o pedido original do resumo da demanda', () => {
    expect(pedidoOriginalDoResumo('Destinatário: X\n\nPedido original: "tira nota, 10 costela"')).toBe('tira nota, 10 costela');
    expect(pedidoOriginalDoResumo('sem original')).toBe('');
  });
});
