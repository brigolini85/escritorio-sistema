/**
 * Tela do Assistente (Parte G4, spec 7C.3): cada resposta vira texto curto + cartões VER AO LADO, e o conteúdo grande
 * (prévia de pedido, tabela, arquivo do Bling) vira um resultado no painel da direita, com abas. Só lê o que já está na
 * mensagem (texto e `arquivo`); nada aqui muda o que o assistente grava.
 */
import { formatarHora } from './formatos';
import { compararPrevia, interpretarPrevias, type PreviaInterpretada } from './previa-pedido';
import { blocosDoTexto, LINHA_TABELA, SEPARADOR_TABELA } from './texto-assistente';

/** Mensagem da conversa com o assistente como a tela lê (assistente_mensagens; o RLS só entrega as da própria pessoa). */
export type MensagemTela = { id: string; papel: 'usuario' | 'assistente'; conteudo: string; arquivo: unknown; processada_em: string | null; criado_em: string };

export type ArquivoBling = { nome: string; partes: number; chamados: string[] };
export type TabelaResposta = { cabecalho: string[]; linhas: string[][] };

export type Cartao =
  | { tipo: 'pedido'; chave: string; rotulo: string }
  | { tipo: 'tabela'; chave: string; rotulo: string }
  | { tipo: 'arquivo'; chave: 'arquivos'; rotulo: string; mensagemId: string; arquivo: ArquivoBling };

/** Pedaço da resposta mostrada no balão, na ordem do texto. */
export type Pedaco = { tipo: 'texto'; texto: string } | { tipo: 'cartao'; cartao: Cartao };

export type ResultadoPedido = {
  tipo: 'pedido'; chave: string; numero: number | null; previa: PreviaInterpretada; mensagemId: string; em: string; rotulo: string;
  /** Quantas prévias a mesma resposta trouxe: com mais de uma, "sim" é ambíguo (D7). */
  previasNaMensagem: number;
};
export type ResultadoTabela = { tipo: 'tabela'; chave: string; titulo: string; tabela: TabelaResposta; mensagemId: string; em: string; rotulo: string };
export type ArquivoGerado = { mensagemId: string; em: string; arquivo: ArquivoBling };
export type ResultadoArquivos = { tipo: 'arquivos'; chave: 'arquivos'; arquivos: ArquivoGerado[]; em: string; rotulo: string };
export type Resultado = ResultadoPedido | ResultadoTabela | ResultadoArquivos;

export type LeituraConversa = {
  /** Pedaços de cada resposta do assistente, por id da mensagem. */
  respostas: Map<string, Pedaco[]>;
  /** Pedidos e tabelas do mais novo para o mais antigo; Arquivos (se houver) no fim. */
  resultados: Resultado[];
  padrao: string | null;
};

export const MAX_ABAS = 5;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const CHAVE = new RegExp(`^(?:pedido-\\d{1,9}|(?:previa|tabela)-${UUID}-\\d{1,3}|arquivos)$`, 'i');

/** "Prévia do pedido #536:" → 536. O último "#N" da última linha do cabeçalho, se ela fala em prévia; senão null (D19). */
export function numeroDoCabecalho(cabecalho: string): number | null {
  // Só a linha logo antes de "Antes:" e só se ela fala em prévia: "#N" do texto livre (ou entre prévias) é de outra coisa.
  const ultima = cabecalho.split(/\r?\n/).filter((l) => l.trim()).at(-1) ?? '';
  if (!/previa/i.test(ultima.normalize('NFD').replace(/\p{M}/gu, ''))) return null;
  const achados = [...ultima.matchAll(/#\s?(\d{1,9})\b/g)];
  return achados.length ? Number(achados.at(-1)![1]) : null;
}

/** `arquivo` da mensagem: só o CSV do Bling (o formato que o trabalhador grava). */
export function lerArquivo(arquivo: unknown): ArquivoBling | null {
  const a = arquivo as { tipo?: unknown; nome?: unknown; partes?: unknown; chamados?: unknown } | null;
  if (!a || a.tipo !== 'csv_bling' || typeof a.nome !== 'string' || !Array.isArray(a.chamados)) return null;
  const partes = typeof a.partes === 'number' && a.partes > 1 ? Math.floor(a.partes) : 1;
  return { nome: a.nome, partes, chamados: a.chamados.filter((c): c is string => typeof c === 'string') };
}

/** Linhas que mudaram na prévia, sem contar o total (ele muda junto com qualquer item). */
export function contarMudancas(p: PreviaInterpretada): number {
  return compararPrevia(p).filter((l) => l.mudanca !== 'igual' && !(l.tipo === 'campo' && /^total$/i.test(l.rotulo))).length;
}

const rotuloPrevia = (numero: number | null, n: number) =>
  `Prévia${numero !== null ? ` #${numero}` : ''} · ${n === 0 ? 'nenhuma mudança' : n === 1 ? '1 alteração' : `${n} alterações`}`;

/** Título da tabela: a linha logo antes dela, se for "# título" ou terminar em ":" (até 60 letras). */
function tituloDaTabela(antes: string[]): string | null {
  const linha = [...antes].reverse().find((l) => l.trim())?.trim() ?? '';
  const titulo = linha.replace(/\*\*/g, '');
  const ehTitulo = /^#{1,6}\s+/.test(titulo) || titulo.endsWith(':');
  const limpo = titulo.replace(/^#{1,6}\s+/, '').replace(/:\s*$/, '').trim();
  return ehTitulo && limpo && limpo.length <= 60 ? limpo : null;
}

/** Texto com tabelas: o texto em volta fica no balão; cada tabela vira cartão e resultado. */
function separarTabelas(texto: string, mensagemId: string, em: string, inicio: number) {
  const linhas = texto.replace(/\r\n?/g, '\n').split('\n');
  const pedacos: Pedaco[] = [];
  const tabelas: ResultadoTabela[] = [];
  let buffer: string[] = [];
  let n = inicio;
  const soltar = () => {
    const t = buffer.join('\n').trim();
    if (t) pedacos.push({ tipo: 'texto', texto: t });
    buffer = [];
  };
  for (let i = 0; i < linhas.length; i++) {
    if (LINHA_TABELA.test(linhas[i]!) && SEPARADOR_TABELA.test(linhas[i + 1] ?? '')) {
      let fim = i + 2;
      while (fim < linhas.length && LINHA_TABELA.test(linhas[fim]!)) fim++;
      const bloco = blocosDoTexto(linhas.slice(i, fim).join('\n'))[0];
      if (bloco?.tipo === 'tabela') {
        const titulo = tituloDaTabela(buffer) ?? `Tabela das ${formatarHora(em)}`;
        soltar();
        const chave = `tabela-${mensagemId}-${n++}`;
        const qtd = bloco.linhas.length;
        tabelas.push({ tipo: 'tabela', chave, titulo, tabela: { cabecalho: bloco.cabecalho, linhas: bloco.linhas }, mensagemId, em, rotulo: `${titulo} (${qtd})` });
        pedacos.push({ tipo: 'cartao', cartao: { tipo: 'tabela', chave, rotulo: `Tabela · ${qtd} ${qtd === 1 ? 'linha' : 'linhas'}` } });
        i = fim - 1;
        continue;
      }
    }
    buffer.push(linhas[i]!);
  }
  soltar();
  return { pedacos, tabelas, proximo: n };
}

function lerResposta(m: MensagemTela, podeCsv: boolean) {
  const pedacos: Pedaco[] = [];
  const pedidos: ResultadoPedido[] = [];
  const tabelas: ResultadoTabela[] = [];
  let n = 0;
  const texto = (t: string) => {
    if (!t.trim()) return;
    const r = separarTabelas(t, m.id, m.criado_em, n);
    n = r.proximo;
    pedacos.push(...r.pedacos);
    tabelas.push(...r.tabelas);
  };
  const previas = interpretarPrevias(m.conteudo);
  if (!previas) texto(m.conteudo);
  else {
    previas.forEach((p, i) => {
      texto(p.cabecalho);
      const numero = numeroDoCabecalho(p.cabecalho);
      const chave = numero !== null ? `pedido-${numero}` : `previa-${m.id}-${i}`;
      pedidos.push({ tipo: 'pedido', chave, numero, previa: p, mensagemId: m.id, em: m.criado_em,
        rotulo: numero !== null ? `Pedido #${numero}` : 'Prévia de pedido', previasNaMensagem: previas.length });
      pedacos.push({ tipo: 'cartao', cartao: { tipo: 'pedido', chave, rotulo: rotuloPrevia(numero, contarMudancas(p)) } });
      texto(p.rodape);
    });
  }
  // O CSV só aparece para quem pode gerá-lo (como hoje, D12).
  const arquivo = podeCsv ? lerArquivo(m.arquivo) : null;
  if (arquivo) pedacos.push({ tipo: 'cartao', cartao: { tipo: 'arquivo', chave: 'arquivos', rotulo: arquivo.nome, mensagemId: m.id, arquivo } });
  return { pedacos, pedidos, tabelas, arquivo: arquivo ? { mensagemId: m.id, em: m.criado_em, arquivo } : null };
}

const tempo = (iso: string) => new Date(iso).getTime();

/** Lê a conversa inteira (em ordem) e monta as respostas curtas, os resultados e a aba padrão (D9). */
export function lerConversa(mensagens: MensagemTela[], podeCsv: boolean): LeituraConversa {
  const respostas = new Map<string, Pedaco[]>();
  const pedidos = new Map<string, ResultadoPedido>();
  const tabelas: ResultadoTabela[] = [];
  const arquivos: ArquivoGerado[] = [];
  const cartoesDePedido: { cartao: Extract<Cartao, { tipo: 'pedido' }>; pedido: ResultadoPedido }[] = [];
  for (const m of mensagens) {
    if (m.papel !== 'assistente') continue;
    const r = lerResposta(m, podeCsv);
    respostas.set(m.id, r.pedacos);
    // Os cartões de pedido saem na mesma ordem das prévias da resposta.
    const cartoes = r.pedacos.flatMap((x) => (x.tipo === 'cartao' && x.cartao.tipo === 'pedido' ? [x.cartao] : []));
    cartoes.forEach((cartao, i) => cartoesDePedido.push({ cartao, pedido: r.pedidos[i]! }));
    // O mesmo pedido de novo: fica a prévia mais nova.
    for (const p of r.pedidos) pedidos.set(p.chave, p);
    tabelas.push(...r.tabelas);
    if (r.arquivo) arquivos.push(r.arquivo);
  }
  // Cartão de prévia antiga abre a mais nova do mesmo pedido: o rótulo não pode contar as mudanças da antiga.
  for (const { cartao, pedido } of cartoesDePedido) {
    if (pedidos.get(cartao.chave) !== pedido) cartao.rotulo = `Prévia #${pedido.numero} anterior · o painel mostra a mais recente`;
  }
  const porData: Resultado[] = [...pedidos.values(), ...tabelas].sort((a, b) => tempo(b.em) - tempo(a.em));
  const resultados: Resultado[] = arquivos.length
    ? [...porData, { tipo: 'arquivos', chave: 'arquivos', arquivos: [...arquivos].reverse(), em: arquivos.at(-1)!.em, rotulo: 'Arquivos' }]
    : porData;
  return { respostas, resultados, padrao: porData[0]?.chave ?? (arquivos.length ? 'arquivos' : null) };
}

/** `?resultado=` da tela: só uma chave no formato conhecido. */
export function lerChaveResultado(valor: string | string[] | undefined): string | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && CHAVE.test(v) ? v : null;
}

/** A aba pedida, se existe nesta conversa; senão a padrão. */
export function escolherResultado(l: LeituraConversa, chave: string | null): Resultado | null {
  return l.resultados.find((r) => r.chave === chave) ?? l.resultados.find((r) => r.chave === l.padrao) ?? null;
}

/** Até MAX_ABAS pedidos/tabelas (os mais recentes), mais a escolhida se ficou de fora, e Arquivos no fim. */
export function abasVisiveis(l: LeituraConversa, selecionada: string | null): Resultado[] {
  const outras = l.resultados.filter((r) => r.tipo !== 'arquivos');
  const abas = outras.slice(0, MAX_ABAS);
  const escolhida = outras.find((r) => r.chave === selecionada);
  if (escolhida && !abas.includes(escolhida)) abas.push(escolhida);
  const arquivos = l.resultados.find((r) => r.tipo === 'arquivos');
  return arquivos ? [...abas, arquivos] : abas;
}

/**
 * SIM, GRAVAR / MUDAR OUTRA COISA só embaixo da prévia que o "sim" vai gravar (D7): a da última mensagem da conversa,
 * única nessa resposta e com número. (Pergunta depois dela, respondida ou não, tira os botões.)
 */
export function podeResponderPrevia(mensagens: MensagemTela[], r: ResultadoPedido): boolean {
  const ultima = mensagens.at(-1);
  return r.numero !== null && r.previasNaMensagem === 1 && ultima?.id === r.mensagemId && ultima.papel === 'assistente';
}

export function hrefResultado(conversaId: string | null, chave: string): string {
  const p = new URLSearchParams(conversaId ? { conversa: conversaId, resultado: chave } : { resultado: chave });
  return `/assistente?${p.toString()}`;
}

/** O arquivo do Bling mais recente desta conversa que leva a demanda. */
export function arquivoDoPedido(l: LeituraConversa, chamadoId: string): ArquivoGerado | null {
  const r = l.resultados.find((x): x is ResultadoArquivos => x.tipo === 'arquivos');
  return r?.arquivos.find((a) => a.arquivo.chamados.includes(chamadoId)) ?? null;
}
