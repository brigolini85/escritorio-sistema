import { describe, expect, it } from 'vitest';
import type { ProdutoEmpresa, UnidadeParceiro } from '@escritorio/db';
import { chaveConferencia, formatarReais, mesmaUnidade, montarPedidoNota, montarPedidoVenda, montarResumoParaCliente } from '../../src/agente/pedido-nota';

const efigenia: UnidadeParceiro = { id: 'u1', grupoId: 'g1', tipo: 'cliente', rede: 'Supermercado Brasil', unidade: 'Santa Efigênia',
  razaoSocial: 'Supermercado Brasil Ltda', cnpj: '11111111000191', ie: '0012345670011', bairro: 'Santa Efigênia', cidade: 'Belo Horizonte', uf: 'MG', palavrasChave: [],
  endereco: 'Rua Salinas', numero: '1200', complemento: 'loja 2', cep: '30150230' };
const costela: ProdutoEmpresa = { id: 'p1', codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC', apelidos: [] };
const frango: ProdutoEmpresa = { id: 'p2', codigo: '14', descricao: 'Frango com Requeijão', unidade: 'PAC', apelidos: [] };
const original = 'Tira NF pro Brasil Santa Efigênia: 20 PAC costela, 15 frango e 3 lasanha';

describe('formatarReais', () => {
  it('formata em reais com milhar', () => {
    expect(formatarReais(9.5)).toBe('R$ 9,50');
    expect(formatarReais(1234.5)).toBe('R$ 1.234,50');
  });
});

describe('montarPedidoNota', () => {
  it('venda com destino, preços da tabela, item sem preço e item não cadastrado', () => {
    const r = montarPedidoNota({
      tipo: 'venda', destino: efigenia, textoDestinatario: 'Brasil Santa Efigênia', pedidoOriginal: original, semPermissao: false,
      itens: [
        { produto: costela, texto: 'costela', quantidade: 20, unidade: 'PAC', preco: 9.5 },
        { produto: frango, texto: 'frango', quantidade: 15, unidade: 'PAC', preco: null },
        { produto: null, texto: 'lasanha', quantidade: 3, unidade: 'PAC', preco: null },
      ],
    });
    expect(r.titulo).toBe('NF de venda – Supermercado Brasil / Santa Efigênia');
    expect(r.resumo).toBe([
      'Destinatário: Supermercado Brasil / Santa Efigênia – Supermercado Brasil Ltda – CNPJ 11.111.111/0001-91 – IE 0012345670011',
      '20 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 190,00',
      '15 PAC Frango com Requeijão (cód. 14) – sem preço cadastrado',
      '3 PAC lasanha – PRODUTO NÃO CADASTRADO',
      'Total (itens com preço): R$ 190,00',
      '',
      `Pedido original: "${original}"`,
    ].join('\n'));
  });

  it('destinatário não cadastrado, quantidade decimal e contato sem permissão', () => {
    const r = montarPedidoNota({
      tipo: 'venda', destino: null, textoDestinatario: 'Mercado Novo', pedidoOriginal: 'nota pro Mercado Novo 2,5 kg costela', semPermissao: true,
      itens: [{ produto: null, texto: 'costela', quantidade: 2.5, unidade: 'kg', preco: null }],
    });
    expect(r.titulo).toBe('NF de venda – destinatário não cadastrado');
    expect(r.resumo).toContain('Destinatário: NÃO CADASTRADO – "Mercado Novo"');
    expect(r.resumo).toContain('2,5 kg costela – PRODUTO NÃO CADASTRADO');
    expect(r.resumo).not.toContain('Total');
    expect(r.resumo).toContain('Observação: contato sem permissão para pedir nota.');
  });

  it('devolução não leva preço', () => {
    const boi: UnidadeParceiro = { ...efigenia, id: 'u9', tipo: 'fornecedor', rede: 'Frigorífico Boi Bom', unidade: 'Matriz', razaoSocial: null, cnpj: null, ie: null };
    const r = montarPedidoNota({
      tipo: 'devolucao', destino: boi, textoDestinatario: 'Boi Bom', pedidoOriginal: 'devolução 3 costela', semPermissao: false,
      itens: [{ produto: costela, texto: 'costela', quantidade: 3, unidade: 'PAC', preco: 9.5 }],
    });
    expect(r.titulo).toBe('NF de devolução – Frigorífico Boi Bom / Matriz');
    expect(r.resumo.split('\n').slice(0, 2)).toEqual(['Fornecedor: Frigorífico Boi Bom / Matriz', '3 PAC Costela com Requeijão (cód. 12)']);
  });
});

describe('revisão final: unidade do cliente diferente da cadastrada', () => {
  it('mantém a unidade pedida, avisa a diferença e não calcula o item', () => {
    const r = montarPedidoNota({
      tipo: 'venda', destino: efigenia, textoDestinatario: 'Brasil Santa Efigênia', pedidoOriginal: '10 kg costela', semPermissao: false,
      itens: [{ produto: costela, texto: 'costela', quantidade: 10, unidade: 'kg', preco: 9.5 }],
    });
    expect(r.resumo).toContain('10 kg Costela com Requeijão (cód. 12) – ATENÇÃO: pedido em kg, produto cadastrado em PAC; sem cálculo');
    expect(r.resumo).not.toContain('Total');
    expect(r.resumo).not.toContain('R$');
  });
});

describe('unidade de contagem (bug do pedido 21, 2026-09-29)', () => {
  const pastel: ProdutoEmpresa = { id: 'p3', codigo: '00070341434147', descricao: 'Pastel de angu', unidade: 'PC', apelidos: [] };

  it('UN, PC, PAC, PCT, pacote e peça são a mesma unidade; kg, CX e FD não', () => {
    for (const [a, b] of [['PAC', 'PC'], ['pct', 'UN'], ['pacote', 'PC'], ['peça', 'pac'], ['und', 'PAC']]) expect(mesmaUnidade(a!, b!)).toBe(true);
    for (const [a, b] of [['kg', 'PAC'], ['CX', 'PC'], ['FD', 'UN'], ['g', 'kg']]) expect(mesmaUnidade(a!, b!)).toBe(false);
  });

  it('pedido em PAC de produto cadastrado em PC usa a unidade e o preço do cadastro', () => {
    const itens = [{ produto: pastel, texto: 'costela', quantidade: 10, unidade: 'PAC', preco: 25 }];
    const r = montarPedidoNota({ tipo: 'venda', destino: efigenia, textoDestinatario: 'sup brasil', pedidoOriginal: 'x', semPermissao: false, itens });
    expect(r.resumo).toContain('10 PC Pastel de angu (cód. 00070341434147) × R$ 25,00 = R$ 250,00');
    const v = montarPedidoVenda({ agora: new Date('2026-09-29T17:55:00Z'), destino: efigenia, textoDestinatario: 'sup brasil', itens, extras: {} });
    expect(v.itens).toEqual([{ produto: 'Pastel de angu', sku: '00070341434147', un: 'PC', quantidade: 10, valor_unitario: 25 }]);
  });

  it('pedido em kg de produto em PAC continua sem valor, para o Fiscal conferir', () => {
    const v = montarPedidoVenda({ agora: new Date(), destino: efigenia, textoDestinatario: 'x', extras: {},
      itens: [{ produto: costela, texto: 'costela', quantidade: 3, unidade: 'kg', preco: 9.5 }] });
    expect(v.itens[0]).toMatchObject({ un: 'KG', valor_unitario: null });
  });
});

describe('resumo para o cliente conferir (pedido do dono, 2026-09-29)', () => {
  const itens = [
    { produto: costela, texto: 'costela', quantidade: 20, unidade: 'PAC', preco: 9.5 },
    { produto: frango, texto: 'frango', quantidade: 2, unidade: 'kg', preco: 8 },
    { produto: null, texto: 'lasanha', quantidade: 3, unidade: 'PAC', preco: null },
  ];

  it('venda: destinatário com CNPJ, itens com código, preço e subtotal, total e o combinado', () => {
    const r = montarResumoParaCliente({ tipo: 'venda', destino: efigenia, textoDestinatario: 'Brasil', itens,
      extras: { forma_pagamento: 'PIX', data_prevista: '30/09/2026', valor_frete: 15, tipo_frete: 'D', observacoes: 'depois das 14h' } });
    expect(r).toBe([
      '*Nota de venda*',
      'Para: Supermercado Brasil Ltda – CNPJ 11.111.111/0001-91',
      'Endereço: Rua Salinas, 1200, loja 2 – Santa Efigênia – Belo Horizonte/MG – CEP 30150-230',
      '• 20 PAC Costela com Requeijão (cód. 12) – R$ 9,50 = R$ 190,00',
      '• 2 KG Frango com Requeijão (cód. 14) – sem preço: produto cadastrado em PAC, a equipe confere',
      '• 3 PAC lasanha – produto não cadastrado, a equipe confere',
      'Total: R$ 205,00 (com frete de R$ 15,00; itens sem preço de fora)',
      'Pagamento: PIX · Entrega: 30/09/2026 · Frete: por conta do destinatário · Obs.: depois das 14h',
    ].join('\n'));
  });

  it('venda simples: total sem observações a mais', () => {
    const r = montarResumoParaCliente({ tipo: 'venda', destino: efigenia, textoDestinatario: 'Brasil', itens: [itens[0]!], extras: {} });
    expect(r.split('\n').slice(-1)[0]).toBe('Total: R$ 190,00');
  });

  it('devolução: fornecedor e itens, sem preços', () => {
    const r = montarResumoParaCliente({ tipo: 'devolucao', destino: null, textoDestinatario: 'Boi Bom', itens: [itens[0]!], extras: {} });
    expect(r).toBe(['*Nota de devolução*', 'Para: Boi Bom (não cadastrado, a equipe confere)', '• 20 PAC Costela com Requeijão (cód. 12)'].join('\n'));
  });

  it('chave de conferência: mesma para o mesmo pedido, muda se mudar destinatário ou item', () => {
    const base = { tipo: 'venda' as const, unidade_id: 'u1', itens: [{ produto_id: 'p1', texto: 'Costela', quantidade: 20, unidade: 'PAC' }] };
    const k = chaveConferencia(base);
    expect(chaveConferencia({ ...base, itens: [{ produto_id: 'p1', texto: ' costela ', quantidade: 20, unidade: 'pac' }] })).toBe(k);
    expect(chaveConferencia({ ...base, unidade_id: 'u2' })).not.toBe(k);
    expect(chaveConferencia({ ...base, itens: [{ ...base.itens[0]!, quantidade: 21 }] })).not.toBe(k);
  });
});

describe('endereço no resumo (pedido do dono, 2026-09-29)', () => {
  const item = { produto: costela, texto: 'costela', quantidade: 1, unidade: 'PAC', preco: 9.5 };
  const linhas = (r: string) => r.split('\n');

  it('entrega combinada em outro endereço aparece como "Entrega em"', () => {
    const r = montarResumoParaCliente({ tipo: 'venda', destino: efigenia, textoDestinatario: 'x', itens: [item],
      extras: { entrega: { endereco: 'Rua B', numero: '5', complemento: null, bairro: null, cidade: 'Itabira', uf: 'MG', cep: '35900000' } } });
    expect(linhas(r)[2]).toBe('Endereço: Rua Salinas, 1200, loja 2 – Santa Efigênia – Belo Horizonte/MG – CEP 30150-230');
    expect(linhas(r)[3]).toBe('Entrega em: Rua B, 5 – Itabira/MG – CEP 35900-000');
  });

  it('sem endereço no cadastro: avisa que a equipe confere', () => {
    const semEndereco = { ...efigenia, endereco: null, numero: null, complemento: null, cep: null, bairro: null, cidade: null, uf: null };
    const r = montarResumoParaCliente({ tipo: 'venda', destino: semEndereco, textoDestinatario: 'x', itens: [item], extras: {} });
    expect(linhas(r)[2]).toBe('Endereço: não cadastrado, a equipe confere');
  });
});
