import { describe, expect, it } from 'vitest';
import {
  conferirFontes, csvDoResultado, ehResultadoTarefa, etapasDoProcedimento, leituraDoArquivo, mimeDoArquivo, numeroDaPendencia,
  podeAprovarTarefa, tarefaAtiva, type ResultadoTarefa,
} from '../src';

const PROC = `# Fechamento mensal

Siga na ordem.

## Etapas
1. **Coletar documentos** — extratos, notas e folha
2. Ler e lançar: partidas dobradas
3. Conciliar
4. Revisar pendências
5. Aprovação

## Regras
- nunca invente valores`;

const resultado = (linhas: ResultadoTarefa['linhas']): ResultadoTarefa =>
  ({ versao: 1, resumo: 'Prévia do fechamento.', destaques: [{ rotulo: 'Lançamentos', valor: '2', detalhe: null }], linhas, observacoes: null });

describe('etapas do procedimento (D5)', () => {
  it('lê a seção "## Etapas", tira negrito e explicação, e põe Aprovação no fim uma vez só', () => {
    expect(etapasDoProcedimento(PROC)).toEqual(['Coletar documentos', 'Ler e lançar', 'Conciliar', 'Revisar pendências', 'Aprovação']);
  });
  it('sem procedimento ou sem a seção: as etapas padrão', () => {
    const padrao = ['Ler os documentos', 'Fazer o trabalho', 'Revisar pendências', 'Aprovação'];
    expect(etapasDoProcedimento(null)).toEqual(padrao);
    expect(etapasDoProcedimento('# Só texto\n\n- um item solto')).toEqual(padrao);
  });
  it('no máximo 8 etapas do procedimento; aceita "### Etapas" e marcadores', () => {
    const muitas = `### Etapas\n${Array.from({ length: 12 }, (_, i) => `- Passo ${i + 1}`).join('\n')}`;
    const r = etapasDoProcedimento(muitas);
    expect(r).toHaveLength(9);
    expect(r.at(-1)).toBe('Aprovação');
  });
  it('sub-itens indentados e linhas de continuação não viram nem cortam etapas', () => {
    const corpo = ['## Etapas', '1. Coletar documentos', '   - extratos do mês', '   - notas fiscais', '   continuação da explicação', '2. Conciliar', '', '3. Revisar', '## Regras', '- não é etapa'].join(String.fromCharCode(10));
    expect(etapasDoProcedimento(corpo)).toEqual(['Coletar documentos', 'Conciliar', 'Revisar', 'Aprovação']);
  });
});

describe('arquivos da tarefa (D14, D15)', () => {
  it('pela extensão, sem diferença de maiúscula', () => {
    expect(leituraDoArquivo('Extrato Itaú.PDF')).toBe('pdf');
    expect(leituraDoArquivo('nota.xml')).toBe('texto');
    expect(leituraDoArquivo('banco.ofx')).toBe('texto');
    expect(leituraDoArquivo('foto.jpeg')).toBe('imagem');
    expect(leituraDoArquivo('planilha.xlsx')).toBeNull();
    expect(leituraDoArquivo('sem-extensao')).toBeNull();
  });
  it('tipo para guardar', () => {
    expect(mimeDoArquivo('a.pdf')).toBe('application/pdf');
    expect(mimeDoArquivo('a.png')).toBe('image/png');
    expect(mimeDoArquivo('a.ofx')).toBe('text/plain');
  });
});

describe('fontes do resultado (D9)', () => {
  const fontes = { arquivosLidos: ['extrato itau.pdf', 'folha.csv'], pendenciasRespondidas: [1], pendenciasAbertas: [2] };
  it('arquivo lido (sem diferença de maiúscula) e pendência respondida valem', () => {
    const r = resultado([
      { descricao: 'Tarifa', valor: 12.5, texto: null, fonte: 'Extrato Itau.pdf', provisoria: false },
      { descricao: 'PIX Roberto', valor: 3200, texto: null, fonte: 'pendência 1', provisoria: false },
    ]);
    expect(conferirFontes(r, fontes)).toEqual([]);
  });
  it('fonte inventada, arquivo não lido, pendência aberta sem provisória e pendência que não existe: recusa com a linha', () => {
    const r = resultado([
      { descricao: 'Saldo BB', valor: 1000, texto: null, fonte: 'extrato bb.pdf', provisoria: false },
      { descricao: 'Despesa', valor: 480, texto: null, fonte: 'Pendencia 2', provisoria: false },
      { descricao: 'Outra', valor: 1, texto: null, fonte: 'pendência 9', provisoria: true },
      { descricao: 'Vazia', valor: null, texto: null, fonte: 'folha.csv', provisoria: false },
    ]);
    expect(conferirFontes(r, fontes)).toEqual([
      'Linha 1 (Saldo BB): "extrato bb.pdf" não é um arquivo lido nesta tarefa.',
      'Linha 2 (Despesa): a pendência 2 ainda está aberta; marque a linha como provisória.',
      'Linha 3 (Outra): a pendência 9 não existe nesta tarefa.',
      'Linha 4 (Vazia): sem valor nem texto.',
    ]);
  });
  it('nome do arquivo em NFD (macOS) e NFC valem como o mesmo, com espaços repetidos', () => {
    const nfd = 'Extrato Itaú.pdf'.normalize('NFD');
    const r = resultado([{ descricao: 'Tarifa', valor: 1, texto: null, fonte: 'Extrato  Itaú.pdf', provisoria: false }]);
    expect(conferirFontes(r, { arquivosLidos: [nfd], pendenciasRespondidas: [], pendenciasAbertas: [] })).toEqual([]);
  });
  it('pendência aberta em linha provisória vale', () => {
    const r = resultado([{ descricao: 'Despesa', valor: 480, texto: null, fonte: 'pendência nº 2', provisoria: true }]);
    expect(conferirFontes(r, fontes)).toEqual([]);
  });
  it('número da pendência', () => {
    expect(numeroDaPendencia('pendência 3')).toBe(3);
    expect(numeroDaPendencia('Pendencia nº 12')).toBe(12);
    expect(numeroDaPendencia('pendências')).toBeNull();
  });
});

describe('resultado no banco e CSV (D10)', () => {
  it('reconhece só o formato da versão 1', () => {
    expect(ehResultadoTarefa(resultado([]))).toBe(true);
    expect(ehResultadoTarefa({ versao: 2, resumo: 'x', destaques: [], linhas: [], observacoes: null })).toBe(false);
    expect(ehResultadoTarefa({ versao: 1, resumo: 'x', destaques: [], linhas: [{ descricao: 'a' }], observacoes: null })).toBe(false);
  });
  it('CSV com BOM, ";", vírgula decimal, aspas e sem fórmula', () => {
    const csv = csvDoResultado(resultado([
      { descricao: 'Tarifa; pacote', valor: 1234.5, texto: null, fonte: 'extrato.pdf', provisoria: false },
      { descricao: '=SOMA(A1)', valor: null, texto: 'ver "nota"', fonte: 'pendência 1', provisoria: true },
    ]));
    expect(csv.startsWith('\uFEFFDescrição;Valor;Texto;Fonte;Provisória\r\n')).toBe(true);
    expect(csv).toContain('"Tarifa; pacote";1234,50;;extrato.pdf;não\r\n');
    expect(csv).toContain(`'=SOMA(A1);;"ver ""nota""";pendência 1;sim\r\n`);
  });
});

describe('estado', () => {
  it('ativa e aprovação (D11)', () => {
    expect(tarefaAtiva('pausada')).toBe(true);
    expect(tarefaAtiva('aprovada')).toBe(false);
    expect(podeAprovarTarefa('pronta', 0)).toBe(true);
    expect(podeAprovarTarefa('pronta', 1)).toBe(false);
    expect(podeAprovarTarefa('aguardando_pendencias', 0)).toBe(false);
  });
});
