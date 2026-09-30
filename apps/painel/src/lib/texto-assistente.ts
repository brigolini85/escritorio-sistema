/**
 * Texto das respostas do assistente (site) em blocos para a tela: parágrafos, listas, tabelas no formato
 * "| a | b |" e títulos "# …". Negrito com **…** vira trecho marcado. Nunca vira HTML: a tela monta os elementos
 * com o texto como está (nada de dangerouslySetInnerHTML com texto do modelo).
 */

export type Trecho = { texto: string; negrito: boolean };

export type Bloco =
  | { tipo: 'paragrafo'; texto: string }
  | { tipo: 'titulo'; texto: string }
  /** `inicio`: número do primeiro item da lista numerada (o modelo pode começar em "3."); 1 na lista com marcadores. */
  | { tipo: 'lista'; ordenada: boolean; inicio: number; itens: string[] }
  | { tipo: 'tabela'; cabecalho: string[]; linhas: string[][] };

const ITEM_LISTA = /^\s*(?:[•\-–]|\*(?!\*))\s+(.*)$/;
const ITEM_NUMERADO = /^\s*(\d{1,3})[.)]\s+(.*)$/;
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
      const texto = (item ? item[1]! : numerado![2]!).trim();
      const ultimo = blocos.at(-1);
      // Itens seguidos (sem linha em branco no meio) ficam na mesma lista.
      const anteriorEraItem = i > 0 && (ordenada ? ITEM_NUMERADO : ITEM_LISTA).test(linhas[i - 1]!);
      if (ultimo?.tipo === 'lista' && ultimo.ordenada === ordenada && anteriorEraItem) ultimo.itens.push(texto);
      else blocos.push({ tipo: 'lista', ordenada, inicio: numerado ? Number(numerado[1]) : 1, itens: [texto] });
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

/** Valor, quantidade ou porcentagem ("R$ 1.280,00", "15", "-3,5 %"). */
const NUMERICO = /^-?(?:R\$\s*)?-?[\d.,]+\s*%?$/;
export const celulaNumerica = (c: string) => NUMERICO.test(c.trim());

/** Colunas da tabela em que todas as células preenchidas são números: ficam alinhadas à direita. */
export function colunasNumericas(tabela: { cabecalho: string[]; linhas: string[][] }): boolean[] {
  return tabela.cabecalho.map((_, c) => {
    const preenchidas = tabela.linhas.map((l) => l[c] ?? '').filter((v) => v.trim());
    return preenchidas.length > 0 && preenchidas.every(celulaNumerica);
  });
}

/** Limite da pergunta no servidor (acoes.ts: Pergunta.max(4000)). */
export const LIMITE_PERGUNTA = 4000;

/**
 * Tamanho da pergunta como o servidor recebe: o navegador envia cada quebra de linha do textarea como "\r\n"
 * (2 caracteres), mas o maxlength do campo conta 1. Os espaços das pontas saem (o servidor faz trim).
 */
export function tamanhoEnviado(texto: string): number {
  return texto.replace(/\r\n|\r|\n/g, '\r\n').trim().length;
}
