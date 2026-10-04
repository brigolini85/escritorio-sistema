import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { FiltrosContatos } from '@/lib/contatos';

// A FilterBar usa o roteador do navegador: aqui só importa quais filtros ela recebe.
vi.mock('@/components/patterns/filter-bar', () => ({
  FilterBar: ({ filtros = [] }: { filtros?: { param: string }[] }) =>
    React.createElement('div', { 'data-filtros-barra': filtros.map((f) => f.param).join(' ') }),
}));

// JSX do painel compila no modo clássico no Vitest (tsconfig jsx: preserve), como nos outros testes de componente.
(globalThis as { React?: unknown }).React = React;
const { BarraContatos } = await import('./barra-contatos');

const F: FiltrosContatos = { q: null, rapido: null, empresa: null, periodo: null };
const CONTAGENS = { todos: 3, desligado: 1, sem_empresa: 1, nota: 2, preco: 1 };
const barra = (completa: boolean) => renderToStaticMarkup(React.createElement(BarraContatos, {
  params: {}, f: F, contagens: CONTAGENS, empresas: [{ id: 'e1', nome: 'Rede' }], ordem: { coluna: 'ultimo', direcao: 'desc' }, completa,
}));

describe('BarraContatos', () => {
  it('com a visão: empresa, período, os cinco filtros rápidos com contagem e a ordem', () => {
    const html = barra(true);
    expect(html).toContain('data-filtros-barra="empresa periodo"');
    for (const f of ['todos', 'desligado', 'sem_empresa', 'nota', 'preco']) expect(html).toContain(`data-filtro="${f}"`);
    expect(html).toMatch(/Ordem: (<!-- -->)?último contato/);
    expect(html).not.toContain('falta a atualização do banco');
  });

  it('sem a visão (D14): só a busca e o aviso — nada de filtros rápidos, contagens, empresa, período nem ordem', () => {
    const html = barra(false);
    expect(html).toContain('data-filtros-barra=""');
    expect(html).not.toContain('data-filtro=');
    expect(html).not.toContain('data-contagem');
    expect(html).not.toContain('Ordem:');
    expect(html).toContain('falta a atualização do banco desta versão');
  });
});
