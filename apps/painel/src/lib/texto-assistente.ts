/**
 * Texto das respostas do assistente (site) em blocos para a tela: parágrafos, listas, tabelas no formato
 * "| a | b |" e títulos "# …". Negrito com **…** vira trecho marcado. Nunca vira HTML: a tela monta os elementos
 * com o texto como está (nada de dangerouslySetInnerHTML com texto do modelo).
 */

export type Trecho = { texto: string; negrito: boolean };

export type Bloco =
  | { tipo: 'paragrafo'; texto: string }
  | { tipo: 'titulo'; texto: string }
  | { tipo: 'lista'; ordenada: boolean; itens: string[] }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][] };

const ITEM_LISTA = /^\s*(?:[•\-–]|\*(?!\*))\s+(.*)$/;
const ITEM_NUMERADO = /^\s*\d{1,3}[.)]\s+(.*)$/;
const TITULO = /^\s*#{1,6}\s+(.*)$/;
const LINHA_TABELA = /^\s*\|.*\|\s*$/;
const SEPARADOR_TABELA = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function celulas(linha: string): string[] {
  return linha.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

/** Divide o texto em blocos. Linha em branco separa parágrafos; as quebras dentro do parágrafo ficam. */
export function blocosDoTexto(texto: string): Bloco[] {
  const linhas = texto.replace(/\r\n?/g, '\n').split('\n');
  const blocos: Bloco[] = [];
  let paragrafo: string[] = [];

  const fecharParagrafo = () => {
    const t = paragrafo.join('\n').trim();
    if (t) blocos.push({ tipo: 'paragrafo', texto: t });
    paragrafo = [];
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]!;

    // Tabela: linha "| … |" seguida do separador "|---|---|".
    if (LINHA_TABELA.test(linha) && SEPARADOR_TABELA.test(linhas[i + 1] ?? '')) {
      fecharParagrafo();
      const cabecalho = celulas(linha);
      const corpo: string[][] = [];
      i += 2;
      while (i < linhas.length && LINHA_TABELA.test(linhas[i]!)) {
        const c = celulas(linhas[i]!);
        // Linha com colunas a menos ou a mais fica do tamanho do cabeçalho.
        corpo.push(cabecalho.map((_, n) => c[n] ?? ''));
        i++;
      }
      i--;
      blocos.push({ tipo: 'tabela', cabecalho, linhas: corpo });
      continue;
    }

    const titulo = TITULO.exec(linha);
    if (titulo) {
      fecharParagrafo();
      blocos.push({ tipo: 'titulo', texto: titulo[1]!.trim() });
      continue;
    }

    const item = ITEM_LISTA.exec(linha);
    const numerado = item ? null : ITEM_NUMERADO.exec(linha);
    if (item || numerado) {
      fecharParagrafo();
      const ordenada = Boolean(numerado);
      const texto = (item ?? numerado)![1]!.trim();
      const ultimo = blocos.at(-1);
      // Itens seguidos (sem linha em branco no meio) ficam na mesma lista.
      const anteriorEraItem = i > 0 && (ordenada ? ITEM_NUMERADO : ITEM_LISTA).test(linhas[i - 1]!);
      if (ultimo?.tipo === 'lista' && ultimo.ordenada === ordenada && anteriorEraItem) ultimo.itens.push(texto);
      else blocos.push({ tipo: 'lista', ordenada, itens: [texto] });
      continue;
    }

    if (!linha.trim()) {
      fecharParagrafo();
      continue;
    }
    paragrafo.push(linha);
  }
  fecharParagrafo();
  return blocos;
}

/** "Total: **R$ 95,00**" → trechos com negrito. Asteriscos sem par ficam como estão. */
export function trechosDoTexto(texto: string): Trecho[] {
  const saida: Trecho[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let inicio = 0;
  for (let m = re.exec(texto); m; m = re.exec(texto)) {
    if (m.index > inicio) saida.push({ texto: texto.slice(inicio, m.index), negrito: false });
    saida.push({ texto: m[1]!, negrito: true });
    inicio = m.index + m[0].length;
  }
  if (inicio < texto.length) saida.push({ texto: texto.slice(inicio), negrito: false });
  return saida;
}
