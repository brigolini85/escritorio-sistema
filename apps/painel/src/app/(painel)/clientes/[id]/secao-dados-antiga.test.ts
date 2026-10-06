import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

// Revisão geral (painel I7): a ficha antiga não pode oferecer "Salvar serviços"/"Salvar responsáveis" com a lista vazia
// quando a leitura falhou (salvar apagaria o contrato). Com erro, aparece o aviso no lugar do formulário.
const falso = vi.hoisted(() => ({ erroEm: null as string | null }));
vi.mock('server-only', () => ({}));
vi.mock('../acoes', () => ({ salvarCliente: () => {}, salvarServicos: () => {}, salvarResponsaveis: () => {} }));
vi.mock('./edicao-alternavel', () => ({ BotoesEdicao: () => null, EdicaoAlternavel: () => null }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    from: (t: string) => {
      const r = t === falso.erroEm ? { data: null, error: { message: 'timeout' } } : { data: [], error: null };
      const q = { select: () => q, eq: () => q, order: () => q, then: (ok: (v: unknown) => unknown) => Promise.resolve(r).then(ok) };
      return q;
    },
  }),
}));

import { SecaoDados } from './secao-dados-antiga';

/** Conta os <form> e os avisos de leitura da árvore devolvida (sem renderizar). */
function varrer(n: unknown, acc = { forms: 0, texto: '', avisos: 0 }) {
  if (Array.isArray(n)) { n.forEach((x) => varrer(x, acc)); return acc; }
  if (typeof n === 'string') { acc.texto += n; return acc; }
  const el = n as ReactElement<{ children?: unknown }> | null;
  if (!el || typeof el !== 'object' || !('props' in el)) return acc;
  if (el.type === 'form') acc.forms += 1;
  if (typeof el.type === 'function' && el.type.name === 'AvisoLeitura') acc.avisos += 1;
  varrer(el.props.children, acc);
  return acc;
}
const cliente = { id: 'c', razao_social: 'R', nome_fantasia: null, cnpj: '1', inscricao_estadual: null, regime: null, uf: null, endereco: null, agente_pausado: false } as never;
const u = { id: 'u', papel: 'admin' } as never;

describe('ficha antiga: serviços e responsáveis com erro de leitura', () => {
  it('leitura ok: os dois formulários aparecem', async () => {
    falso.erroEm = null;
    expect(varrer(await SecaoDados({ id: 'c', u, pode: true, c: cliente })).forms).toBe(3);
  });
  it.each(['cliente_servicos', 'servicos'])('erro em %s: sem formulário de serviços, com aviso', async (t) => {
    falso.erroEm = t;
    const r = varrer(await SecaoDados({ id: 'c', u, pode: true, c: cliente }));
    expect(r.forms).toBe(2);
    expect(r.avisos).toBe(1);
  });
  it.each(['cliente_responsaveis', 'usuarios', 'setores'])('erro em %s: sem formulário de responsáveis', async (t) => {
    falso.erroEm = t;
    expect(varrer(await SecaoDados({ id: 'c', u, pode: true, c: cliente })).forms).toBe(2);
  });
});
