/**
 * Estado das tabelas (DataTable/FilterBar) na URL: ordenação, página, busca e filtros.
 * Funções puras: a página (server component) lê searchParams, ordena/pagina e monta os links.
 * Parâmetros: `ordem` (coluna), `direcao` (asc | desc), `pagina` (1, 2...), mais os de busca e filtro de cada tela.
 */

export type ParamsBusca = Record<string, string | string[] | undefined>;
export type Direcao = 'asc' | 'desc';
export type Ordem = { coluna: string; direcao: Direcao };

export const PARAM_ORDEM = 'ordem';
export const PARAM_DIRECAO = 'direcao';
export const PARAM_PAGINA = 'pagina';

/** Primeiro valor de um parâmetro (Next entrega string[] quando ele se repete). */
export function valorParam(params: ParamsBusca, nome: string): string | undefined {
  const v = params[nome];
  return Array.isArray(v) ? v[0] : v;
}

/** Ordem pedida na URL, se a coluna for ordenável; senão a padrão. */
export function lerOrdem(params: ParamsBusca, ordenaveis: readonly string[], padrao: Ordem | null = null): Ordem | null {
  const coluna = valorParam(params, PARAM_ORDEM);
  if (!coluna || !ordenaveis.includes(coluna)) return padrao;
  return { coluna, direcao: valorParam(params, PARAM_DIRECAO) === 'desc' ? 'desc' : 'asc' };
}

/** Página pedida (1 em diante); lixo ou negativo vira 1. */
export function lerPagina(params: ParamsBusca): number {
  const n = Number.parseInt(valorParam(params, PARAM_PAGINA) ?? '', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** Clicar no cabeçalho: coluna nova começa crescente; a mesma coluna alterna crescente/decrescente. */
export function proximaOrdem(atual: Ordem | null, coluna: string): Ordem {
  if (atual?.coluna === coluna) return { coluna, direcao: atual.direcao === 'asc' ? 'desc' : 'asc' };
  return { coluna, direcao: 'asc' };
}

/**
 * Link para o mesmo endereço com parâmetros trocados (null ou '' apaga).
 * Mudar qualquer coisa que não seja a página volta para a página 1 (a página antiga pode nem existir no resultado novo).
 */
export function hrefComParams(params: ParamsBusca, mudancas: Record<string, string | number | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue;
    for (const item of Array.isArray(v) ? v : [v]) sp.append(k, item);
  }
  const mudaPagina = Object.keys(mudancas).some((k) => k !== PARAM_PAGINA);
  if (mudaPagina && !(PARAM_PAGINA in mudancas)) sp.delete(PARAM_PAGINA);
  for (const [k, v] of Object.entries(mudancas)) {
    if (v === null || v === undefined || v === '') sp.delete(k);
    else sp.set(k, String(v));
  }
  if (sp.get(PARAM_PAGINA) === '1') sp.delete(PARAM_PAGINA);
  const q = sp.toString();
  return q ? `?${q}` : '?';
}

/** Link do cabeçalho de uma coluna ordenável. */
export function hrefOrdenar(params: ParamsBusca, atual: Ordem | null, coluna: string): string {
  const o = proximaOrdem(atual, coluna);
  return hrefComParams(params, { [PARAM_ORDEM]: o.coluna, [PARAM_DIRECAO]: o.direcao });
}

export type Paginacao = { pagina: number; totalPaginas: number; de: number; ate: number; total: number; inicio: number; fim: number };

/**
 * Faixa da página: `inicio`/`fim` são índices (slice, ou range do PostgREST com fim - 1);
 * `de`/`ate` são para mostrar ("Mostrando 51–100 de 132"). Página além da última cai na última.
 */
export function paginar(total: number, paginaPedida: number, porPagina: number): Paginacao {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const pagina = Math.min(Math.max(1, Math.floor(paginaPedida) || 1), totalPaginas);
  const inicio = (pagina - 1) * porPagina;
  const fim = Math.min(inicio + porPagina, total);
  return { pagina, totalPaginas, inicio, fim, de: total === 0 ? 0 : inicio + 1, ate: fim, total };
}

const colacao = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

/** Ordena uma cópia das linhas pelo valor dado (texto em ordem do português, números, datas); vazios sempre no fim. */
export function ordenarLinhas<T>(linhas: readonly T[], valor: (l: T) => string | number | Date | null | undefined, direcao: Direcao): T[] {
  const sinal = direcao === 'asc' ? 1 : -1;
  return [...linhas].sort((a, b) => {
    const va = valor(a);
    const vb = valor(b);
    const vazioA = va === null || va === undefined || va === '';
    const vazioB = vb === null || vb === undefined || vb === '';
    if (vazioA || vazioB) return vazioA === vazioB ? 0 : vazioA ? 1 : -1;
    if (typeof va === 'string' && typeof vb === 'string') return sinal * colacao.compare(va, vb);
    const na = va instanceof Date ? va.getTime() : Number(va);
    const nb = vb instanceof Date ? vb.getTime() : Number(vb);
    return sinal * (na - nb);
  });
}
