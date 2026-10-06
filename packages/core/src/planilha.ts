/**
 * Parte I3b (D10): a planilha do resultado, montada pelo nosso código a partir das linhas (nada roda na Anthropic, D16 da I3a).
 * Só as partes XML: quem entrega compacta (o painel usa fflate). Texto vai sempre como célula de texto: nada vira fórmula.
 */
import { ROTULO_TIPO_PENDENCIA, type ResultadoTarefa, type TipoPendencia } from './tarefas';

export const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export type PendenciaPlanilha = { numero: number; tipo: TipoPendencia; pergunta: string; estado: 'aberta' | 'respondida'; resposta: string | null };
export type CelulaPlanilha = string | number | null;
export type AbaPlanilha = { nome: string; colunas: { titulo: string; largura: number; dinheiro?: boolean }[]; linhas: CelulaPlanilha[][] };

export function abasDoResultado(r: ResultadoTarefa, pendencias: readonly PendenciaPlanilha[]): AbaPlanilha[] {
  return [
    {
      nome: 'Resultado',
      colunas: [{ titulo: 'Descrição', largura: 50 }, { titulo: 'Valor', largura: 16, dinheiro: true }, { titulo: 'Texto', largura: 30 },
        { titulo: 'Fonte', largura: 30 }, { titulo: 'Provisória', largura: 11 }],
      linhas: r.linhas.map((l) => [l.descricao, l.valor, l.texto, l.fonte, l.provisoria ? 'sim' : 'não']),
    },
    {
      nome: 'Destaques',
      colunas: [{ titulo: 'Destaque', largura: 30 }, { titulo: 'Valor', largura: 20 }, { titulo: 'Detalhe', largura: 40 }],
      linhas: [['Resumo', r.resumo, r.observacoes], ...r.destaques.map((d): CelulaPlanilha[] => [d.rotulo, d.valor, d.detalhe])],
    },
    {
      nome: 'Pendências',
      colunas: [{ titulo: 'Nº', largura: 6 }, { titulo: 'Para quem', largura: 16 }, { titulo: 'Pergunta', largura: 50 },
        { titulo: 'Situação', largura: 12 }, { titulo: 'Resposta', largura: 50 }],
      linhas: pendencias.map((p) => [p.numero, ROTULO_TIPO_PENDENCIA[p.tipo], p.pergunta, p.estado === 'aberta' ? 'Aberta' : 'Respondida', p.resposta]),
    },
  ];
}

// F19: surrogate solto vira U+FFFD (toWellFormed) antes de tudo; XML 1.0 não aceita controles (exceto tab e quebras)
// nem U+FFFE/U+FFFF: saem antes de escapar. Os dois últimos ficam como escapes no código-fonte, nunca literais.
// (a lib do core é anterior ao ES2024: o método existe no Node 22, só falta no tipo)
const bemFormado = (v: string): string => (v as string & { toWellFormed(): string }).toWellFormed();
const xml = (v: string) => bemFormado(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\uFFFE\uFFFF]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function coluna(n: number): string {
  let s = '';
  for (let i = n + 1; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
  return s;
}
const CABECALHO_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

// Estilo 1 = cabeçalho em negrito; 2 = dinheiro (#,##0.00); 0 = normal (o Nº da pendência fica "1", não "1,00").
// Texto é sempre inlineStr (nunca <f>): "=", "+", "-", "@" no começo não viram fórmula.
function celula(ref: string, v: CelulaPlanilha, estilo: 0 | 1 | 2): string {
  if (v === null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${estilo === 0 ? '' : ` s="${estilo}"`}><v>${v}</v></c>`;
  const s = estilo === 1 ? ' s="1"' : '';
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
}

function folha(a: AbaPlanilha): string {
  const cols = a.colunas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.largura}" customWidth="1"/>`).join('');
  const linhas = [a.colunas.map((c) => c.titulo), ...a.linhas].map((l, i) => {
    const r = i + 1;
    return `<row r="${r}">${l.map((v, j) => celula(`${coluna(j)}${r}`, v, i === 0 ? 1 : a.colunas[j]?.dinheiro ? 2 : 0)).join('')}</row>`;
  });
  return `${CABECALHO_XML}<worksheet ${NS}><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>`
    + `</sheetView></sheetViews><cols>${cols}</cols><sheetData>${linhas.join('')}</sheetData></worksheet>`;
}

const ESTILOS = `${CABECALHO_XML}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
  + '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>'
  + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
  + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
  + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  + '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'
  + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

/** As partes do pacote XLSX (Office Open XML), na ordem estável: o mesmo resultado dá as mesmas partes. */
export function partesDaPlanilha(abas: readonly AbaPlanilha[]): Record<string, string> {
  const n = abas.length;
  const partes: Record<string, string> = {
    '[Content_Types].xml': `${CABECALHO_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + abas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': `${CABECALHO_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `${CABECALHO_XML}<workbook ${NS}><sheets>`
      + abas.map((a, i) => `<sheet name="${xml(a.nome.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>',
    'xl/_rels/workbook.xml.rels': `${CABECALHO_XML}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + abas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
      + `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': ESTILOS,
  };
  abas.forEach((a, i) => { partes[`xl/worksheets/sheet${i + 1}.xml`] = folha(a); });
  return partes;
}
