import type { SupabaseClient } from '@supabase/supabase-js';
import { lerEmPaginas } from './paginas';

/**
 * Auditoria 6.6: a conversa abre nas mensagens mais novas. Antes, `order('criado_em')` sem limite parava no max_rows do
 * PostgREST (1000) na ordem crescente: a conversa de um cliente ativo mostrava só as 1000 mais antigas, sem aviso.
 */
export const MENSAGENS_POR_PAGINA = 200;

/** Instante do banco (ISO com fuso). O "+" do fuso vira espaço quando a URL não o codifica. */
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:\d{2})$/;

/** ?anteriores= da tela: só um instante válido vira filtro; o resto é ignorado (abre nas mais novas). */
export function lerCursorAnteriores(v: string | string[] | undefined): string | null {
  const bruto = (Array.isArray(v) ? v[0] : v)?.trim().replace(/ (\d{2}:\d{2})$/, '+$1');
  if (!bruto || !INSTANTE.test(bruto) || Number.isNaN(Date.parse(bruto))) return null;
  return bruto;
}

/** Começo do dia em São Paulo (sem horário de verão desde 2019): o ?data= de Gastos com IA abre a partir dele. */
export const inicioDoDiaSaoPaulo = (dia: string) => `${dia}T00:00:00-03:00`;

export type LeituraMensagens<T> = {
  /** Em ordem crescente (a mais nova por último). */
  mensagens: T[];
  /** O cursor do "Ver anteriores" (criado_em da mais antiga na tela); null quando não há mais antigas. */
  anteriores: string | null;
  erro: unknown;
};

/**
 * Sem `antes`: as `porPagina` mais novas. Com `antes`: a página anterior a ele (criado_em < antes) e todas a partir dele
 * (criado_em >= antes, de 1000 em 1000), então nada entre o cursor e a mais nova fica de fora e a mensagem que chega ao vivo
 * aparece no fim. O índice mensagens_conversa_idx (conversa_id, criado_em) atende as duas consultas.
 */
export async function lerMensagensDaConversa<T extends { criado_em: string }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any, any, any>, conversaId: string,
  { antes = null, porPagina = MENSAGENS_POR_PAGINA, colunas = '*' }: { antes?: string | null; porPagina?: number; colunas?: string } = {},
): Promise<LeituraMensagens<T>> {
  const base = () => sb.from('mensagens').select(colunas).eq('conversa_id', conversaId);
  // Uma a mais só para saber se há anteriores.
  const pagina = antes ? base().lt('criado_em', antes) : base();
  const { data, error } = await pagina.order('criado_em', { ascending: false }).order('id', { ascending: false }).limit(porPagina + 1);
  const linhas = (data ?? []) as unknown as T[];
  const haMais = linhas.length > porPagina;
  const antigas = linhas.slice(0, porPagina).reverse();
  let recentes: T[] = [];
  let erro: unknown = error;
  if (antes) {
    const r = await lerEmPaginas((de, ate) => base().gte('criado_em', antes).order('criado_em').order('id').range(de, ate));
    recentes = r.data as unknown as T[];
    erro = erro ?? r.error;
  }
  const mensagens = [...antigas, ...recentes];
  return { mensagens, anteriores: haMais && mensagens.length ? mensagens[0]!.criado_em : null, erro };
}
