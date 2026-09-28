import { describe, expect, it } from 'vitest';
import type { ProdutoEmpresa, UnidadeParceiro } from '@escritorio/db';
import { formatarReais, montarPedidoNota } from '../../src/agente/pedido-nota';

const efigenia: UnidadeParceiro = { id: 'u1', grupoId: 'g1', tipo: 'cliente', rede: 'Supermercado Brasil', unidade: 'Santa Efigênia',
  razaoSocial: 'Supermercado Brasil Ltda', cnpj: '11111111000191', ie: '0012345670011', bairro: 'Santa Efigênia', cidade: 'Belo Horizonte', uf: 'MG', palavrasChave: [] };
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
