import { describe, expect, it } from 'vitest';
import { blocosDoTexto, trechosDoTexto } from './texto-assistente';

describe('blocosDoTexto', () => {
  it('texto simples vira um parágrafo e mantém as quebras', () => {
    expect(blocosDoTexto('mensagem 39\nsegunda linha\nterceira linha')).toEqual([
      { tipo: 'paragrafo', texto: 'mensagem 39\nsegunda linha\nterceira linha' },
    ]);
  });

  it('linha em branco separa parágrafos; título e listas', () => {
    expect(blocosDoTexto('## Notas abertas\nSão 2:\n• #12 Mercado\n- #13 Padaria\n\n1. conferir\n2) gravar\n\nPosso ajudar em algo mais?')).toEqual([
      { tipo: 'titulo', texto: 'Notas abertas' },
      { tipo: 'paragrafo', texto: 'São 2:' },
      { tipo: 'lista', ordenada: false, itens: ['#12 Mercado', '#13 Padaria'] },
      { tipo: 'lista', ordenada: true, itens: ['conferir', 'gravar'] },
      { tipo: 'paragrafo', texto: 'Posso ajudar em algo mais?' },
    ]);
  });

  it('listas separadas por linha em branco ficam separadas', () => {
    expect(blocosDoTexto('• a\n\n• b')).toEqual([
      { tipo: 'lista', ordenada: false, itens: ['a'] },
      { tipo: 'lista', ordenada: false, itens: ['b'] },
    ]);
  });

  it('tabela com separador; linha curta completa com vazio', () => {
    expect(blocosDoTexto('Vendas:\n| Mês | Total |\n|---|---:|\n| Agosto | R$ 1.280,00 |\n| Setembro |\nFim')).toEqual([
      { tipo: 'paragrafo', texto: 'Vendas:' },
      { tipo: 'tabela', cabecalho: ['Mês', 'Total'], linhas: [['Agosto', 'R$ 1.280,00'], ['Setembro', '']] },
      { tipo: 'paragrafo', texto: 'Fim' },
    ]);
  });

  it('"| a |" sem separador não é tabela; **negrito** no começo não é item', () => {
    expect(blocosDoTexto('| a |\n**Total:** R$ 5,00')).toEqual([{ tipo: 'paragrafo', texto: '| a |\n**Total:** R$ 5,00' }]);
  });

  it('vazio', () => {
    expect(blocosDoTexto('')).toEqual([]);
  });
});

describe('trechosDoTexto', () => {
  it('marca o negrito e deixa o resto', () => {
    expect(trechosDoTexto('Total: **R$ 95,00** hoje')).toEqual([
      { texto: 'Total: ', negrito: false },
      { texto: 'R$ 95,00', negrito: true },
      { texto: ' hoje', negrito: false },
    ]);
    expect(trechosDoTexto('2 * 3 = 6')).toEqual([{ texto: '2 * 3 = 6', negrito: false }]);
    expect(trechosDoTexto('')).toEqual([]);
  });
});
