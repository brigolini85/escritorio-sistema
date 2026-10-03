// Os filtros da URL aplicados numa consulta à visão demandas_lista. Um lugar só para a tabela, os contadores,
// o quadro e o CSV do Bling: o arquivo leva exatamente o que a tela mostra (pendência 10 do redesign).
import { interpretarBusca } from './busca';
import { inicioDoDiaSP, inicioDoPeriodo, type FiltrosDemandas } from './demandas';

/** O que os filtros usam do construtor de consultas do PostgREST. */
export type ConsultaFiltravel<Q> = {
  is(coluna: string, valor: boolean | null): Q;
  eq(coluna: string, valor: string): Q;
  in(coluna: string, valores: readonly string[]): Q;
  gte(coluna: string, valor: string): Q;
  lt(coluna: string, valor: string): Q;
  or(filtros: string): Q;
};

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** `semStatus`: o quadro mostra todos os status em colunas, então os botões de status não entram. */
export function aplicarFiltrosDemandas<Q extends ConsultaFiltravel<Q>>(
  q: Q, f: FiltrosDemandas, euId: string, agora: Date, opcoes: { semStatus?: boolean } = {},
): Q {
  let r = q;
  if (f.setor === 'triagem') r = r.is('setor_id', null);
  else if (f.setor !== 'todos') r = r.eq('setor_id', f.setor);
  if (!opcoes.semStatus) r = r.in('status', f.status);
  if (f.origem === 'equipe') r = r.eq('origem', 'equipe');
  else if (f.origem === 'agente') r = r.in('origem', ['agente', 'sistema']);
  if (f.vencidas) r = r.is('vencida', true);
  if (f.prazoHoje) {
    const inicio = inicioDoDiaSP(agora);
    r = r.gte('prazo_em', inicio.toISOString()).lt('prazo_em', new Date(inicio.getTime() + UM_DIA_MS).toISOString());
  }
  if (f.responsavel === 'sem') r = r.is('responsavel_id', null);
  else if (f.responsavel) r = r.eq('responsavel_id', f.responsavel === 'eu' ? euId : f.responsavel);
  if (f.prioridade) r = r.eq('prioridade', f.prioridade);
  if (f.tipo) r = r.is('tem_pedido', f.tipo === 'venda');
  const desde = inicioDoPeriodo(f.periodo, agora);
  if (desde) r = r.gte('criado_em', desde);
  const busca = interpretarBusca(f.q);
  if (busca) {
    const texto = ['titulo', 'resumo', 'empresa'].map((c) => `${c}.ilike.%${busca.termo}%`);
    r = r.or((busca.numero !== null ? [`numero.eq.${busca.numero}`, ...texto] : texto).join(','));
  }
  return r;
}

/** Construtor qualquer do PostgREST com estes métodos (as assinaturas genéricas do supabase-js não casam com o tipo estrutural). */
export interface ConsultaQualquer extends ConsultaFiltravel<ConsultaQualquer> {}

/** O mesmo que aplicarFiltrosDemandas, para `sb.from('demandas_lista').select(...)`: devolve o construtor com o tipo dele. */
export function filtrarConsulta<T>(q: T, f: FiltrosDemandas, euId: string, agora: Date, opcoes: { semStatus?: boolean } = {}): T {
  return aplicarFiltrosDemandas(q as unknown as ConsultaQualquer, f, euId, agora, opcoes) as unknown as T;
}
