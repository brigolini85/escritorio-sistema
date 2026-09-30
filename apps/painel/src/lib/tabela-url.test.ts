import { describe, expect, it } from 'vitest';
import { hrefComParams, hrefOrdenar, lerOrdem, lerPagina, ordenarLinhas, paginar, proximaOrdem, valorParam } from './tabela-url';

describe('leitura da URL', () => {
  it('valor repetido pega o primeiro', () => {
    expect(valorParam({ setor: ['a', 'b'] }, 'setor')).toBe('a');
    expect(valorParam({}, 'setor')).toBeUndefined();
  });
  it('ordem só em coluna ordenável; senão a padrão', () => {
    expect(lerOrdem({ ordem: 'empresa', direcao: 'desc' }, ['empresa', 'numero'])).toEqual({ coluna: 'empresa', direcao: 'desc' });
    expect(lerOrdem({ ordem: 'empresa', direcao: 'x' }, ['empresa'])).toEqual({ coluna: 'empresa', direcao: 'asc' });
    expect(lerOrdem({ ordem: 'senha' }, ['empresa'], { coluna: 'numero', direcao: 'desc' })).toEqual({ coluna: 'numero', direcao: 'desc' });
    expect(lerOrdem({}, ['empresa'])).toBeNull();
  });
  it('página inválida vira 1', () => {
    expect(lerPagina({ pagina: '3' })).toBe(3);
    expect(lerPagina({ pagina: '0' })).toBe(1);
    expect(lerPagina({ pagina: '-2' })).toBe(1);
    expect(lerPagina({ pagina: 'abc' })).toBe(1);
    expect(lerPagina({})).toBe(1);
  });
});

describe('links', () => {
  it('troca parâmetros e mantém os outros (inclusive filtros da tela)', () => {
    expect(hrefComParams({ setor: 'fiscal', q: 'pão' }, { status: 'aberto' })).toBe('?setor=fiscal&q=p%C3%A3o&status=aberto');
  });
  it('null ou vazio apaga; sem nada volta "?"', () => {
    expect(hrefComParams({ setor: 'fiscal' }, { setor: null })).toBe('?');
    expect(hrefComParams({ setor: 'fiscal', q: 'x' }, { q: '' })).toBe('?setor=fiscal');
  });
  it('mudar filtro ou ordem volta para a página 1; mudar só a página mantém o resto', () => {
    expect(hrefComParams({ setor: 'fiscal', pagina: '4' }, { setor: 'pessoal' })).toBe('?setor=pessoal');
    expect(hrefComParams({ setor: 'fiscal', pagina: '4' }, { pagina: 5 })).toBe('?setor=fiscal&pagina=5');
    expect(hrefComParams({ setor: 'fiscal', pagina: '4' }, { pagina: 1 })).toBe('?setor=fiscal');
  });
  it('cabeçalho alterna crescente/decrescente e coluna nova começa crescente', () => {
    expect(proximaOrdem(null, 'empresa')).toEqual({ coluna: 'empresa', direcao: 'asc' });
    expect(proximaOrdem({ coluna: 'empresa', direcao: 'asc' }, 'empresa')).toEqual({ coluna: 'empresa', direcao: 'desc' });
    expect(proximaOrdem({ coluna: 'empresa', direcao: 'desc' }, 'empresa')).toEqual({ coluna: 'empresa', direcao: 'asc' });
    expect(proximaOrdem({ coluna: 'empresa', direcao: 'desc' }, 'numero')).toEqual({ coluna: 'numero', direcao: 'asc' });
    expect(hrefOrdenar({ pagina: '2', setor: 'x' }, { coluna: 'numero', direcao: 'asc' }, 'numero')).toBe('?setor=x&ordem=numero&direcao=desc');
  });
});

describe('paginar', () => {
  it('faixa e textos', () => {
    expect(paginar(132, 2, 50)).toEqual({ pagina: 2, totalPaginas: 3, inicio: 50, fim: 100, de: 51, ate: 100, total: 132 });
    expect(paginar(132, 3, 50)).toMatchObject({ de: 101, ate: 132 });
  });
  it('página além da última cai na última; vazio mostra 0', () => {
    expect(paginar(132, 9, 50).pagina).toBe(3);
    expect(paginar(0, 1, 50)).toEqual({ pagina: 1, totalPaginas: 1, inicio: 0, fim: 0, de: 0, ate: 0, total: 0 });
  });
});

describe('ordenarLinhas', () => {
  const linhas = [
    { nome: 'Padaria Pão Quente', n: 10, d: '2026-09-02' },
    { nome: 'auto peças', n: 2, d: '2026-09-30' },
    { nome: 'Ótica Central', n: null, d: null },
    { nome: 'Mercado Bom Preço', n: 100, d: '2026-01-01' },
  ];
  it('texto em ordem do português (acento e caixa não importam)', () => {
    expect(ordenarLinhas(linhas, (l) => l.nome, 'asc').map((l) => l.nome)).toEqual(['auto peças', 'Mercado Bom Preço', 'Ótica Central', 'Padaria Pão Quente']);
  });
  it('números e datas; vazios no fim nos dois sentidos; não altera o original', () => {
    expect(ordenarLinhas(linhas, (l) => l.n, 'asc').map((l) => l.n)).toEqual([2, 10, 100, null]);
    expect(ordenarLinhas(linhas, (l) => l.n, 'desc').map((l) => l.n)).toEqual([100, 10, 2, null]);
    expect(ordenarLinhas(linhas, (l) => (l.d ? new Date(l.d) : null), 'desc').map((l) => l.d)).toEqual(['2026-09-30', '2026-09-02', '2026-01-01', null]);
    expect(linhas[0]!.nome).toBe('Padaria Pão Quente');
  });
});
