import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { carregarPedidosBling, escolherParte } from './bling';
import { lerFiltrosDemandas } from './demandas';

type Resposta = { data: unknown; error: { message: string } | null };

/** Supabase de mentira: cada tabela devolve as respostas da fila, na ordem das consultas. */
function sbFalso(respostas: Record<string, Resposta[]>, faixas: [number, number][] = []) {
  const consulta = (tabela: string) => {
    const q: Record<string, unknown> = {};
    for (const m of ['select', 'not', 'order', 'in', 'eq', 'neq', 'is', 'gte', 'lt', 'or']) q[m] = () => q;
    q.range = (de: number, ate: number) => { faixas.push([de, ate]); return q; };
    q.then = (ok: (r: Resposta) => unknown, erro: (e: unknown) => unknown) => Promise.resolve(respostas[tabela]!.shift()!).then(ok, erro);
    return q;
  };
  return { from: consulta } as never;
}

const pedido = { unidade_id: 'u1', texto_destinatario: 'Brasil', data: '29/09/2026', itens: [{ produto: 'Costela', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 9.5 }],
  data_prevista: null, forma_pagamento: null, valor_frete: null, tipo_frete: null, transportadora: null, observacoes: null, entrega: null };

describe('carregarPedidosBling (revisão final, I)', () => {
  it('um bloco de demandas que falha lança em vez de devolver um arquivo pela metade', async () => {
    const ids = Array.from({ length: 150 }, (_, i) => `id-${i}`);
    const sb = sbFalso({ chamados: [{ data: [{ numero: 1, pedido_venda: pedido }], error: null }, { data: null, error: { message: 'tempo esgotado' } }] });
    await expect(carregarPedidosBling(sb, { ids })).rejects.toThrow('tempo esgotado');
  });
  it('a consulta das demandas do filtro ou a dos cadastros que falha também lança', async () => {
    await expect(carregarPedidosBling(sbFalso({ demandas_lista: [{ data: null, error: { message: 'x' } }] }), { filtros: lerFiltrosDemandas({}), euId: 'u1', agora: new Date() })).rejects.toThrow();
    const sb = sbFalso({ chamados: [{ data: [{ numero: 1, pedido_venda: pedido }], error: null }], parceiros_unidades: [{ data: null, error: { message: 'y' } }] });
    await expect(carregarPedidosBling(sb, { id: 'c1' })).rejects.toThrow('y');
  });
  it('tudo certo: devolve os pedidos', async () => {
    const sb = sbFalso({ chamados: [{ data: [{ numero: 1, pedido_venda: pedido }], error: null }], parceiros_unidades: [{ data: [], error: null }] });
    expect((await carregarPedidosBling(sb, { id: 'c1' })).pedidos).toHaveLength(1);
  });
});

describe('CSV Bling pelo filtro da tela (revisão final da Parte C, I2)', () => {
  const linhas = (de: number, n: number) => Array.from({ length: n }, (_, i) => ({ numero: de + i, pedido_venda: pedido }));
  it('carrega em páginas de 1000 até acabar, sem cortar em 1000', async () => {
    const faixas: [number, number][] = [];
    const sb = sbFalso({
      demandas_lista: [{ data: linhas(1, 1000), error: null }, { data: linhas(1001, 1000), error: null }, { data: linhas(2001, 200), error: null }],
      parceiros_unidades: [{ data: [], error: null }],
    }, faixas);
    const { pedidos } = await carregarPedidosBling(sb, { filtros: lerFiltrosDemandas({}), euId: 'u1', agora: new Date() });
    expect(pedidos).toHaveLength(2200);
    expect(faixas).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it('uma página que falha no meio lança (nada de arquivo pela metade)', async () => {
    const sb = sbFalso({ demandas_lista: [{ data: linhas(1, 1000), error: null }, { data: null, error: { message: 'caiu' } }] });
    await expect(carregarPedidosBling(sb, { filtros: lerFiltrosDemandas({}), euId: 'u1', agora: new Date() })).rejects.toThrow('caiu');
  });
  it('escolherParte: sem parâmetro é a 1; parte além da última ou inválida é recusada (null), nunca trocada pela última', () => {
    expect(escolherParte(null, 3)).toBe(1);
    expect(escolherParte('2', 3)).toBe(2);
    expect(escolherParte('3', 3)).toBe(3);
    expect(escolherParte('4', 3)).toBeNull();
    expect(escolherParte('0', 3)).toBeNull();
    expect(escolherParte('1.5', 3)).toBeNull();
    expect(escolherParte('abc', 3)).toBeNull();
  });
});
