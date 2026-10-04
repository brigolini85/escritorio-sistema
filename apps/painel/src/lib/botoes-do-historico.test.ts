import { describe, expect, it } from 'vitest';
import { botoesDoHistorico } from './conversas-assistente';

const c = (id: string) => ({ id, nome: `Contato ${id}` });

describe('botoesDoHistorico (D14)', () => {
  it('as 2 mais recentes viram botões; as demais vão para o "+n"', () => {
    const r = botoesDoHistorico([c('a'), c('b'), c('c')], null);
    expect(r.botoes.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r.resto.map((x) => x.id)).toEqual(['c']);
  });

  it('a aberta que está no "+n" toma o último botão', () => {
    const lista = [c('a'), c('b'), c('c'), c('d')];
    const r = botoesDoHistorico(lista, lista[3]!);
    expect(r.botoes.map((x) => x.id)).toEqual(['a', 'd']);
    expect(r.resto.map((x) => x.id)).toEqual(['b', 'c']);
  });

  it('a aberta por ?conversa= sem mensagens da pessoa (fora da lista) aparece nos botões', () => {
    const r = botoesDoHistorico([c('a'), c('b'), c('c')], c('x'));
    expect(r.botoes.map((x) => x.id)).toEqual(['a', 'x']);
    expect(r.resto.map((x) => x.id)).toEqual(['b', 'c']);
  });

  it('lista vazia: a aberta é o único botão', () => {
    const r = botoesDoHistorico([], c('x'));
    expect(r.botoes.map((x) => x.id)).toEqual(['x']);
    expect(r.resto).toEqual([]);
  });

  it('usa o item da lista quando a aberta está nela (mesmo id, outro objeto)', () => {
    const lista = [c('a'), c('b'), c('c')];
    const r = botoesDoHistorico(lista, { ...c('c'), nome: 'outro' });
    expect(r.botoes[1]).toBe(lista[2]);
  });
});
