/**
 * Prévia "Antes:/Depois:" que o assistente escreve ao corrigir um pedido (descreverPedido, no trabalhador):
 *   Prévia do pedido #1042:
 *   Antes:
 *   Destinatário: Supermercado Brasil / Santa Efigênia
 *   • 10 PAC Costela com Requeijão (cód. 12) × R$ 9,50 = R$ 95,00
 *   Total: R$ 95,00
 *   Pagamento: Pix · Entrega: 02/10
 *   Depois:
 *   ...
 * Interpreta o texto e compara os dois lados para o DiffPreview. Texto fora do formato → null (a tela mostra o texto puro).
 */

export type ItemPrevia = {
  /** Como o item é reconhecido dos dois lados: o código do produto, ou a descrição. */
  chave: string;
  quantidade: string;
  unidade: string;
  produto: string;
  codigo: string | null;
  preco: string | null;
  subtotal: string | null;
  semPreco: boolean;
  texto: string;
};
export type CampoPrevia = { rotulo: string; valor: string };

type Linha = { tipo: 'item'; item: ItemPrevia } | { tipo: 'campo'; campo: CampoPrevia } | { tipo: 'texto'; texto: string };
export type LadoPrevia = { linhas: Linha[] };
export type PreviaInterpretada = { cabecalho: string; antes: LadoPrevia; depois: LadoPrevia; rodape: string };

const DINHEIRO = String.raw`R\$\s*-?[\d.]+,\d{2}`;
const ITEM = new RegExp(String.raw`^•\s*(\S+)\s+(.*?)(?:\s+×\s+(${DINHEIRO})\s*=\s*(${DINHEIRO})|\s+[–-]\s+sem preço)?\s*$`);
const CAMPO = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{0,39}):\s+(.+)$/;
const CODIGO = /\s*\(cód\.\s*([^)]+)\)/;

const normalizar = (t: string) => t.replace(/\s+/g, ' ').trim();
const chaveTexto = (t: string) => normalizar(t).toLocaleLowerCase('pt-BR');

function lerItem(linha: string): ItemPrevia | null {
  const m = ITEM.exec(linha);
  if (!m) return null;
  const [, quantidade = '', resto = '', preco, subtotal] = m;
  const [unidade = '', ...palavras] = normalizar(resto).split(' ');
  const descricao = palavras.join(' ');
  const codigo = CODIGO.exec(descricao)?.[1]?.trim() ?? null;
  const produto = normalizar(descricao.replace(CODIGO, ''));
  return {
    chave: codigo ? `cód ${codigo}` : chaveTexto(produto || resto),
    quantidade, unidade, produto, codigo,
    preco: preco ? normalizar(preco) : null,
    subtotal: subtotal ? normalizar(subtotal) : null,
    semPreco: !preco,
    texto: normalizar(linha.replace(/^•\s*/, '')),
  };
}

/** "Pagamento: Pix · Entrega: 02/10" vira dois campos; linha comum vira um. */
function lerCampos(linha: string): CampoPrevia[] | null {
  const partes = linha.split(' · ');
  const campos = partes.map((p) => CAMPO.exec(p.trim()));
  if (campos.every(Boolean)) return campos.map((c) => ({ rotulo: normalizar(c![1]!), valor: normalizar(c![2]!) }));
  // "Observações: entregar · pela manhã": o " · " é do texto, não separa campos.
  const inteiro = CAMPO.exec(linha);
  return inteiro ? [{ rotulo: normalizar(inteiro[1]!), valor: normalizar(inteiro[2]!) }] : null;
}

function lerLinha(linha: string): Linha[] {
  const item = linha.trimStart().startsWith('•') ? lerItem(linha.trim()) : null;
  if (item) return [{ tipo: 'item', item }];
  const campos = lerCampos(linha.trim());
  if (campos) return campos.map((campo) => ({ tipo: 'campo', campo }));
  return [{ tipo: 'texto', texto: linha.trim() }];
}

const reconhecida = (l: Linha) => l.tipo !== 'texto';
const OBSERVACOES = /^observa/i;
const QUEBRA = String.fromCharCode(10);

/** Linhas de um lado. Observação com quebra de linha: as linhas seguintes continuam o valor dela. */
function lerBloco(linhas: string[]): Linha[] {
  const saida: Linha[] = [];
  for (const bruta of linhas) {
    if (!bruta.trim()) continue;
    const anterior = saida.at(-1);
    const lidas = lerLinha(bruta);
    if (anterior?.tipo === 'campo' && OBSERVACOES.test(anterior.campo.rotulo) && lidas.every((l) => l.tipo === 'texto')) {
      anterior.campo.valor = [anterior.campo.valor, bruta.trim()].join(QUEBRA);
      continue;
    }
    saida.push(...lidas);
  }
  return saida;
}

export function interpretarPrevia(texto: string): PreviaInterpretada | null {
  const linhas = texto.replace(/\r\n?/g, '\n').split('\n');
  const iAntes = linhas.findIndex((l) => /^\s*Antes:\s*$/i.test(l));
  if (iAntes < 0) return null;
  const iDepois = linhas.findIndex((l, i) => i > iAntes && /^\s*Depois:\s*$/i.test(l));
  if (iDepois < 0) return null;

  const cabecalho = linhas.slice(0, iAntes).join('\n').trim();
  const antes = lerBloco(linhas.slice(iAntes + 1, iDepois));

  // O lado "depois" vai até a primeira linha em branco; o que sobra (e frases soltas no fim, como "Posso gravar?") é rodapé.
  const resto = linhas.slice(iDepois + 1);
  const primeiraVazia = resto.findIndex((l, i) => !l.trim() && resto.slice(0, i).some((x) => x.trim()));
  const blocoDepois = primeiraVazia < 0 ? resto : resto.slice(0, primeiraVazia);
  const rodapeLinhas = primeiraVazia < 0 ? [] : resto.slice(primeiraVazia);
  const depois = lerBloco(blocoDepois);
  const soltas: string[] = [];
  while (depois.length && !reconhecida(depois.at(-1)!)) soltas.unshift((depois.pop() as { texto: string }).texto);

  if (!antes.some(reconhecida) || !depois.some(reconhecida)) return null;
  return {
    cabecalho,
    antes: { linhas: antes },
    depois: { linhas: depois },
    rodape: [...soltas, ...rodapeLinhas].join('\n').trim(),
  };
}

/**
 * Uma resposta pode ter várias prévias (uma por pedido, separadas por linha em branco). Cada uma é lida à parte;
 * o texto entre elas vira o cabeçalho da seguinte. Nenhuma prévia → null.
 */
export function interpretarPrevias(texto: string): PreviaInterpretada[] | null {
  const primeira = interpretarPrevia(texto);
  if (!primeira) return null;
  const seguintes = primeira.rodape ? interpretarPrevias(primeira.rodape) : null;
  return seguintes ? [{ ...primeira, rodape: '' }, ...seguintes] : [primeira];
}

export type Mudanca = 'igual' | 'alterado' | 'adicionado' | 'removido';
export type AlteracoesItem = { quantidade: boolean; unidade: boolean; produto: boolean; preco: boolean; subtotal: boolean };
export type LinhaComparada =
  | { tipo: 'item'; mudanca: Mudanca; item: ItemPrevia; anterior: ItemPrevia | null; alteracoes: AlteracoesItem | null }
  | { tipo: 'campo'; mudanca: Mudanca; rotulo: string; valor: string; anterior: string | null }
  | { tipo: 'texto'; mudanca: Mudanca; texto: string };

function chaveLinha(l: Linha): string {
  if (l.tipo === 'item') return `item:${l.item.chave}`;
  if (l.tipo === 'campo') return `campo:${chaveTexto(l.campo.rotulo)}`;
  return `texto:${chaveTexto(l.texto)}`;
}

/** Chave com a ocorrência (o mesmo produto duas vezes vira dois itens). */
function comOcorrencia(linhas: Linha[]): string[] {
  const vistos = new Map<string, number>();
  return linhas.map((l) => {
    const k = chaveLinha(l);
    const n = vistos.get(k) ?? 0;
    vistos.set(k, n + 1);
    return `${k}#${n}`;
  });
}

function comparar(anterior: Linha | null, atual: Linha, mudancaSemPar: Mudanca): LinhaComparada {
  if (atual.tipo === 'item') {
    const a = anterior?.tipo === 'item' ? anterior.item : null;
    if (!a) return { tipo: 'item', mudanca: mudancaSemPar, item: atual.item, anterior: null, alteracoes: null };
    const i = atual.item;
    const alteracoes = {
      quantidade: a.quantidade !== i.quantidade, unidade: a.unidade !== i.unidade, produto: chaveTexto(a.produto) !== chaveTexto(i.produto),
      preco: a.preco !== i.preco, subtotal: a.subtotal !== i.subtotal,
    };
    const mudou = Object.values(alteracoes).some(Boolean);
    return { tipo: 'item', mudanca: mudou ? 'alterado' : 'igual', item: i, anterior: mudou ? a : null, alteracoes: mudou ? alteracoes : null };
  }
  if (atual.tipo === 'campo') {
    const a = anterior?.tipo === 'campo' ? anterior.campo : null;
    if (!a) return { tipo: 'campo', mudanca: mudancaSemPar, rotulo: atual.campo.rotulo, valor: atual.campo.valor, anterior: null };
    const mudou = a.valor !== atual.campo.valor;
    return { tipo: 'campo', mudanca: mudou ? 'alterado' : 'igual', rotulo: atual.campo.rotulo, valor: atual.campo.valor, anterior: mudou ? a.valor : null };
  }
  return { tipo: 'texto', mudanca: anterior ? 'igual' : mudancaSemPar, texto: atual.texto };
}

/**
 * Compara os dois lados na ordem do "depois"; o que só existia antes entra como removido
 * no lugar onde estava (logo antes do próximo item que continuou).
 */
export function compararPrevia(p: PreviaInterpretada): LinhaComparada[] {
  const antes = p.antes.linhas;
  const depois = p.depois.linhas;
  const chavesAntes = comOcorrencia(antes);
  const chavesDepois = comOcorrencia(depois);
  const posAntes = new Map(chavesAntes.map((k, i) => [k, i]));
  const usados = new Set<number>();
  const saida: LinhaComparada[] = [];
  let proximoAntes = 0;

  const soltarRemovidosAte = (limite: number) => {
    for (; proximoAntes < limite; proximoAntes++) {
      if (!usados.has(proximoAntes) && !chavesDepois.includes(chavesAntes[proximoAntes]!)) {
        saida.push(comparar(null, antes[proximoAntes]!, 'removido'));
      }
    }
  };

  depois.forEach((l, i) => {
    const j = posAntes.get(chavesDepois[i]!);
    if (j === undefined) {
      saida.push(comparar(null, l, 'adicionado'));
      return;
    }
    if (j >= proximoAntes) soltarRemovidosAte(j);
    usados.add(j);
    saida.push(comparar(antes[j]!, l, 'adicionado'));
  });
  soltarRemovidosAte(antes.length);
  return saida;
}
