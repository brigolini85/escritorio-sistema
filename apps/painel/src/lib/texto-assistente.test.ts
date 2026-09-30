import { describe, expect, it } from 'vitest';
import { blocosDoTexto, celulaNumerica, colunasNumericas, LIMITE_PERGUNTA, tamanhoEnviado, trechosDoTexto } from './texto-assistente';

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
      { tipo: 'lista', ordenada: false, inicio: 1, itens: ['#12 Mercado', '#13 Padaria'] },
      { tipo: 'lista', ordenada: true, inicio: 1, itens: ['conferir', 'gravar'] },
      { tipo: 'paragrafo', texto: 'Posso ajudar em algo mais?' },
    ]);
  });

  it('listas separadas por linha em branco ficam separadas', () => {
    expect(blocosDoTexto('• a\n\n• b')).toEqual([
      { tipo: 'lista', ordenada: false, inicio: 1, itens: ['a'] },
      { tipo: 'lista', ordenada: false, inicio: 1, itens: ['b'] },
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

describe('lista numerada', () => {
  it('guarda o número do primeiro item', () => {
    expect(blocosDoTexto('Depois disso:\n3. gravar\n4. gerar o CSV')).toEqual([
      { tipo: 'paragrafo', texto: 'Depois disso:' },
      { tipo: 'lista', ordenada: true, inicio: 3, itens: ['gravar', 'gerar o CSV'] },
    ]);
  });
});

describe('colunas numéricas da tabela', () => {
  it('valores, quantidades e porcentagens; texto não', () => {
    for (const v of ['R$ 1.280,00', 'R$ -9,50', '-R$ 9,50', '15', '3,5 %', '1.042']) expect(celulaNumerica(v)).toBe(true);
    for (const v of ['#1042', '02/10', 'Serra Azul', '', 'R$']) expect(celulaNumerica(v)).toBe(false);
  });
  it('coluna com todas as células preenchidas numéricas; vazias não contam; coluna toda vazia não é numérica', () => {
    const [bloco] = blocosDoTexto('| Demanda | Qtd | Total | Obs |\n|---|---|---|---|\n| #1042 | 15 | R$ 142,50 | |\n| #1043 | | R$ 30,00 | |');
    expect(bloco?.tipo === 'tabela' && colunasNumericas(bloco)).toEqual([false, true, true, false]);
  });
});

describe('tamanhoEnviado', () => {
  it('conta a quebra de linha como o navegador envia (\r\n) e tira as pontas', () => {
    expect(tamanhoEnviado('a\nb')).toBe(4);
    expect(tamanhoEnviado('a\r\nb')).toBe(4);
    expect(tamanhoEnviado('  a  ')).toBe(1);
    const cheio = `${'x'.repeat(LIMITE_PERGUNTA - 2)}\ny`;
    expect(cheio.length).toBe(LIMITE_PERGUNTA); // cabe no maxlength do campo...
    expect(tamanhoEnviado(cheio)).toBe(LIMITE_PERGUNTA + 1); // ...mas passa do limite do servidor
  });
});
