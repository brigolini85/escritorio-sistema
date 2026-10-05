import { describe, expect, it } from 'vitest';
import { ehPreAnaliseNota, preAnalisarPedidoNota, resumoPreAnalise, type CompradorCadastrado, type PedidoVendaSalvo } from '../src';

const comprador: CompradorCadastrado = {
  razao_social: 'Supermercado Brasil Ltda', nome_unidade: 'Santa Efigênia', cnpj: '11111111000191', endereco: 'Rua Salinas', numero: '1200',
  complemento: null, bairro: 'Santa Efigênia', cidade: 'Belo Horizonte', uf: 'MG', cep: '30150230', telefone: null,
};
const item = (extra: Partial<PedidoVendaSalvo['itens'][number]> = {}) =>
  ({ produto: 'Costela com Requeijão', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 9.5, ...extra });
const pedido = (extra: Partial<PedidoVendaSalvo> = {}): PedidoVendaSalvo => ({
  unidade_id: 'u1', texto_destinatario: 'Brasil Santa Efigênia', data: '28/09/2026', itens: [item()], data_prevista: null, forma_pagamento: null,
  valor_frete: null, tipo_frete: null, transportadora: null, observacoes: null, entrega: null, ...extra,
});
const analisar = (p: Partial<Parameters<typeof preAnalisarPedidoNota>[0]> = {}) =>
  preAnalisarPedidoNota({ numero: 41, pedido: pedido(), comprador, mudancas: [], ...p });

describe('pré-análise do pedido de nota (D9)', () => {
  it('pedido completo: tudo OK, com o arquivo do Bling pronto', () => {
    const a = analisar();
    expect(a.versao).toBe(1);
    expect(a.linhas).toEqual([
      { situacao: 'ok', texto: 'Destinatário: Supermercado Brasil Ltda · CNPJ 11.111.111/0001-91.' },
      { situacao: 'ok', texto: '1 item com produto e preço da tabela.' },
      { situacao: 'ok', texto: 'Arquivo do Bling: pronto para gerar.' },
    ]);
    expect(a.contagem).toEqual({ falta: 0, atencao: 0, ok: 3 });
    expect(resumoPreAnalise(a)).toBe('3 OK');
  });
  it('destinatário não cadastrado: falta; sem comprador, o arquivo nem é conferido', () => {
    const a = analisar({ pedido: pedido({ unidade_id: null }), comprador: null });
    expect(a.linhas[0]).toEqual({ situacao: 'falta', texto: 'Destinatário não cadastrado: "Brasil Santa Efigênia". Cadastre antes de emitir.' });
    expect(a.linhas.some((l) => l.texto.startsWith('Arquivo do Bling'))).toBe(false);
  });
  it('sem CNPJ: falta; endereço incompleto: atenção', () => {
    const a = analisar({ comprador: { ...comprador, cnpj: null, cep: null, cidade: ' ' } });
    expect(a.linhas).toContainEqual({ situacao: 'falta', texto: 'Destinatário Supermercado Brasil Ltda sem CNPJ.' });
    expect(a.linhas).toContainEqual({ situacao: 'atencao', texto: 'Endereço do destinatário incompleto: falta cidade, CEP.' });
  });
  it('item sem cadastro e item sem preço (unidade diferente): falta, e o Bling não sai', () => {
    const a = analisar({ pedido: pedido({ itens: [item({ sku: null, produto: 'Lasanha' }), item({ un: 'KG', valor_unitario: null })] }) });
    expect(a.linhas).toContainEqual({ situacao: 'falta', texto: 'Item 1 (Lasanha): produto não cadastrado.' });
    expect(a.linhas).toContainEqual({ situacao: 'falta', texto: 'Item 2 (Costela com Requeijão): sem preço. Confira a tabela da rede ou a unidade pedida (KG).' });
    expect(a.linhas.some((l) => l.situacao === 'falta' && l.texto.startsWith('Arquivo do Bling: ainda não sai'))).toBe(true);
  });
  it('preço que mudou nos últimos 30 dias: atenção com a data e os dois valores', () => {
    const a = analisar({ mudancas: [{ sku: '12', anterior: 8.9, desde: '2026-09-20T15:00:00Z' }] });
    expect(a.linhas).toContainEqual({ situacao: 'atencao', texto: 'Item 1 (Costela com Requeijão): preço mudou em 20/09, de R$ 8,90 para R$ 9,50.' });
    expect(a.linhas.some((l) => l.texto.includes('item com produto e preço'))).toBe(false);
  });
  it('ordem: Falta, Atenção, OK; o resumo conta cada uma', () => {
    const a = analisar({ comprador: { ...comprador, cep: null }, pedido: pedido({ itens: [item(), item({ sku: null })] }) });
    expect(a.linhas.map((l) => l.situacao)).toEqual(['falta', 'atencao', 'ok', 'ok', 'ok']);
    expect(resumoPreAnalise(a)).toBe('1 falta · 1 atenção · 3 OK');
  });
  it('ehPreAnaliseNota reconhece o formato gravado e recusa o resto', () => {
    expect(ehPreAnaliseNota(analisar())).toBe(true);
    expect(ehPreAnaliseNota({ versao: 2, linhas: [], contagem: {} })).toBe(false);
    expect(ehPreAnaliseNota({ versao: 1, linhas: [{ situacao: 'talvez', texto: 'x' }], contagem: {} })).toBe(false);
    expect(ehPreAnaliseNota(null)).toBe(false);
  });
});
