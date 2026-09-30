import type { CompradorCadastrado, PedidoVendaSalvo } from '@escritorio/core';
import { describe, expect, it } from 'vitest';
import { enderecoPorExtenso, resumirPedido } from './resumo-pedido';

const pedido: PedidoVendaSalvo = {
  unidade_id: 'u1', texto_destinatario: 'Supermercado Brasil Santa Efigênia', data: '30/09/2026',
  itens: [
    { produto: 'Costela com Requeijão', sku: '12', un: 'pac', quantidade: 15, valor_unitario: 9.5 },
    { produto: 'Queijo minas', sku: '40', un: 'KG', quantidade: 2.5, valor_unitario: null },
    { produto: 'Guaraná 2L', sku: null, un: 'FD', quantidade: 3, valor_unitario: 0 },
  ],
  data_prevista: '02/10/2026', forma_pagamento: 'Boleto 28 dias', valor_frete: 15, tipo_frete: 'D', transportadora: null,
  observacoes: 'Entregar pela manhã', entrega: null,
};

const comprador: CompradorCadastrado = {
  razao_social: 'Supermercado Brasil Ltda', nome_unidade: 'Santa Efigênia', cnpj: '11222333000181', endereco: 'Rua Pouso Alegre',
  numero: '1200', complemento: null, bairro: 'Santa Efigênia', cidade: 'Belo Horizonte', uf: 'MG', cep: '30260000', telefone: null,
};

describe('resumirPedido', () => {
  it('com cadastro: CNPJ mascarado e endereço por extenso', () => {
    const r = resumirPedido(pedido, comprador)!;
    expect(r.destinatario).toEqual({
      nome: 'Supermercado Brasil Ltda', documento: '11.222.333/0001-81', rotuloDocumento: 'CNPJ', cadastrado: true,
      endereco: 'Rua Pouso Alegre, 1200 - Santa Efigênia, Belo Horizonte/MG, CEP 30260-000',
    });
  });
  it('itens sem valor ficam a conferir, fora do total, e o total fica parcial', () => {
    const r = resumirPedido(pedido)!;
    expect(r.itens[0]).toEqual({ produto: 'Costela com Requeijão', codigo: '12', unidade: 'PAC', quantidade: 15, valorUnitario: 9.5, subtotal: 142.5, aConferir: false });
    expect(r.itens[1]).toMatchObject({ unidade: 'KG', quantidade: 2.5, valorUnitario: null, subtotal: null, aConferir: true });
    expect(r.itens[2]).toMatchObject({ valorUnitario: null, aConferir: true, codigo: null });
    expect(r.subtotalItens).toBe(142.5);
    expect(r.total).toBe(157.5); // com o frete de 15, como a prévia do assistente e o CSV do Bling
    expect(r.totalParcial).toBe(true);
    expect(r.itensAConferir).toBe(2);
  });
  it('sem cadastro vale o texto do cliente; combinado e frete', () => {
    const r = resumirPedido(pedido)!;
    expect(r.destinatario).toEqual({ nome: 'Supermercado Brasil Santa Efigênia', documento: null, rotuloDocumento: 'CPF/CNPJ', endereco: null, cadastrado: false });
    expect(r).toMatchObject({ pagamento: 'Boleto 28 dias', dataPrevista: '02/10/2026', frete: { valor: 15, tipo: 'por conta do destinatário' }, observacoes: 'Entregar pela manhã', entrega: null });
  });
  it('todos com valor: total completo, somado em centavos', () => {
    const r = resumirPedido({ ...pedido, itens: [{ produto: 'A', sku: null, un: null, quantidade: 3, valor_unitario: 0.1 }, { produto: 'B', sku: null, un: 'un', quantidade: 1, valor_unitario: 0.2 }] })!;
    expect(r.subtotalItens).toBe(0.5);
    expect(r.total).toBe(15.5);
    expect(r.totalParcial).toBe(false);
    expect(r.itens[0]!.unidade).toBe('UN');
  });
  it('dado incompleto ou estranho não quebra', () => {
    expect(resumirPedido(null)).toBeNull();
    expect(resumirPedido('texto')).toBeNull();
    expect(resumirPedido({ itens: 'x' })).toBeNull();
    const r = resumirPedido({ itens: [null, { quantidade: '2' }], tipo_frete: 'X', entrega: { cidade: 'Contagem', uf: 'MG' } })!;
    expect(r.itens).toEqual([{ produto: 'Produto sem nome', codigo: null, unidade: 'UN', quantidade: null, valorUnitario: null, subtotal: null, aConferir: true }]);
    expect(r.destinatario.nome).toBe('Destinatário não informado');
    expect(r.frete.tipo).toBeNull();
    expect(r.entrega).toBe('Contagem/MG');
  });
});

describe('total igual ao do assistente e do Bling', () => {
  // Mesma conta de totalDoPedido (apps/trabalhador/src/assistente/vendas.ts) e do "Total Pedido" do core.
  const totalDoPedido = (p: PedidoVendaSalvo) =>
    Math.round((p.itens.reduce((s, i) => s + (i.quantidade !== null && i.valor_unitario !== null ? i.quantidade * i.valor_unitario : 0), 0) + (p.valor_frete ?? 0)) * 100) / 100;
  it('pedido do /_design e variações', () => {
    for (const p of [pedido, { ...pedido, valor_frete: null }, { ...pedido, itens: [{ produto: 'X', sku: null, un: 'UN', quantidade: 3, valor_unitario: 0.1 }] }]) {
      expect(resumirPedido(p)!.total).toBe(totalDoPedido(p));
    }
  });
  it('cada linha é arredondada em centavos antes de somar, como no CSV do Bling', () => {
    // 1 × 0,005 = 0,01 por linha; somando sem arredondar daria 0,01 no total.
    const r = resumirPedido({ ...pedido, valor_frete: null, itens: [
      { produto: 'A', sku: null, un: 'UN', quantidade: 1, valor_unitario: 0.005 },
      { produto: 'B', sku: null, un: 'UN', quantidade: 1, valor_unitario: 0.005 },
    ] })!;
    expect(r.itens.map((i) => i.subtotal)).toEqual([0.01, 0.01]);
    expect(r.subtotalItens).toBe(0.02);
    expect(r.total).toBe(0.02);
  });
  it('CPF de pessoa física e CNPJ alfanumérico', () => {
    expect(resumirPedido(pedido, { ...comprador, cnpj: '12345678909' })!.destinatario).toMatchObject({ documento: '123.456.789-09', rotuloDocumento: 'CPF' });
    expect(resumirPedido(pedido, { ...comprador, cnpj: '12ABC34501DE35' })!.destinatario).toMatchObject({ documento: '12.ABC.345/01DE-35', rotuloDocumento: 'CNPJ' });
  });
});

describe('enderecoPorExtenso', () => {
  it('junta só o que existe', () => {
    expect(enderecoPorExtenso(null)).toBeNull();
    expect(enderecoPorExtenso({ endereco: ' ', cidade: null })).toBeNull();
    expect(enderecoPorExtenso({ endereco: 'Av. Amazonas', numero: '10', complemento: 'loja 2', cep: '30180-001' })).toBe('Av. Amazonas, 10, loja 2, CEP 30180-001');
  });
});
