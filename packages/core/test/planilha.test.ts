import { describe, expect, it } from 'vitest';
import { abasDoResultado, contarProvisorias, partesDaPlanilha, type ResultadoTarefa } from '../src';

const R: ResultadoTarefa = {
  versao: 1, resumo: '3 lançamentos', observacoes: null,
  destaques: [{ rotulo: 'Saídas', valor: 'R$ 1.980,55', detalhe: 'DAS' }],
  linhas: [
    { descricao: 'DAS Simples Nacional', valor: -1980.55, texto: null, fonte: 'extrato.csv', provisoria: false },
    { descricao: '=HYPERLINK("http://x")', valor: null, texto: '+cmd|calc', fonte: '@fonte', provisoria: true },
    { descricao: 'Pão & <café> "especial" 🍞\u0007', valor: 0, texto: null, fonte: 'pendência 2', provisoria: false },
  ],
};
const P = [{ numero: 1, tipo: 'cliente' as const, pergunta: 'Extrato do BB', estado: 'aberta' as const, resposta: null }];

describe('abasDoResultado (D10)', () => {
  it('três abas com cabeçalho; valores como número; null fica vazio', () => {
    const [res, dest, pend] = abasDoResultado(R, P);
    expect([res!.nome, dest!.nome, pend!.nome]).toEqual(['Resultado', 'Destaques', 'Pendências']);
    expect(res!.colunas.map((c) => c.titulo)).toEqual(['Descrição', 'Valor', 'Texto', 'Fonte', 'Provisória']);
    expect(res!.linhas[0]).toEqual(['DAS Simples Nacional', -1980.55, null, 'extrato.csv', 'não']);
    expect(res!.linhas[1]![1]).toBeNull();
    expect(res!.linhas[1]![4]).toBe('sim');
    expect(pend!.linhas[0]).toEqual([1, 'Do cliente', 'Extrato do BB', 'Aberta', null]);
    expect(partesDaPlanilha([pend!])['xl/worksheets/sheet1.xml']).toContain('<c r="A2"><v>1</v></c>');
  });
});

describe('partesDaPlanilha', () => {
  const partes = partesDaPlanilha(abasDoResultado(R, P));
  it('tem as partes mínimas de um XLSX', () => {
    expect(Object.keys(partes).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
      'xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml']);
    expect(partes['xl/workbook.xml']).toContain('<sheet name="Pendências" sheetId="3" r:id="rId3"/>');
    expect(partes['[Content_Types].xml']).toContain('/xl/worksheets/sheet3.xml');
  });
  it('texto é sempre célula de texto (nada vira fórmula) e o XML é escapado', () => {
    const s1 = partes['xl/worksheets/sheet1.xml']!;
    expect(s1).not.toContain('<f>');
    expect(s1).toContain('<c r="A3" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK(&quot;http://x&quot;)</t></is></c>');
    expect(s1).toContain('Pão &amp; &lt;café&gt; &quot;especial&quot; 🍞');
    expect(s1).not.toContain('\u0007');
  });
  it('F19: caracteres que o XML 1.0 não aceita saem; surrogate solto vira U+FFFD', () => {
    const ruim = { ...R, linhas: [{ descricao: 'a\uFFFEb\uFFFFc\u0000d\u001Fe\ud800f\udc00g\tq\nz', valor: null, texto: null, fonte: 'x', provisoria: false }] };
    const s1 = partesDaPlanilha(abasDoResultado(ruim, []))['xl/worksheets/sheet1.xml']!;
    expect(s1).toContain('abcde\uFFFDf\uFFFDg\tq\nz');
    expect(s1).not.toMatch(/[\uFFFE\uFFFF\u0000-\u0008\u000b\u000c\u000e-\u001f]/);
    expect(s1).not.toMatch(/[\ud800-\udfff]/);
  });
  it('número não finito não vira <v>NaN</v>: sai como texto', () => {
    const s1 = partesDaPlanilha([{ nome: 'X', colunas: [{ titulo: 'V', largura: 5 }], linhas: [[Number.NaN], [Infinity]] }])['xl/worksheets/sheet1.xml']!;
    expect(s1).not.toContain('<v>NaN</v>');
    expect(s1).not.toContain('<v>Infinity</v>');
  });
  it('número com o formato de dinheiro (estilo 2) e cabeçalho em negrito (estilo 1)', () => {
    const s1 = partes['xl/worksheets/sheet1.xml']!;
    expect(s1).toContain('<c r="B2" s="2"><v>-1980.55</v></c>');
    expect(s1).toContain('<c r="B4" s="2"><v>0</v></c>');
    expect(s1).toContain('<c r="A1" t="inlineStr" s="1">');
    expect(partes['xl/styles.xml']).toContain('formatCode="#,##0.00"');
  });
  it('mesmo resultado, mesmas partes', () => {
    expect(partesDaPlanilha(abasDoResultado(R, P))).toEqual(partes);
  });
  it('500 linhas cabem', () => {
    const muitas = { ...R, linhas: Array.from({ length: 500 }, (_, i) => ({ descricao: `L${i}`, valor: i, texto: null, fonte: 'x.csv', provisoria: false })) };
    expect(partesDaPlanilha(abasDoResultado(muitas, []))['xl/worksheets/sheet1.xml']).toContain('<row r="501">');
  });
});

describe('contarProvisorias', () => {
  it('conta as linhas provisórias; sem resultado é 0', () => {
    expect(contarProvisorias(R)).toBe(1);
    expect(contarProvisorias(null)).toBe(0);
  });
});
