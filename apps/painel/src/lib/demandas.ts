/**
 * Filtros da tela Demandas (só leitura da URL). `setor` é o parâmetro de sempre (todos | triagem | id do setor),
 * o mesmo que a exportação do CSV do Bling usa. Os outros são novos e só estreitam a tabela:
 * - status: aberto | em_andamento | aguardando_cliente | concluido (sem o parâmetro: todas as não concluídas, como antes);
 * - responsavel: eu | sem | id da pessoa;
 * - tipo: venda (tem pedido de nota, pedido_venda preenchido) | outras (sem pedido de nota).
 *   Não existe coluna de tipo em chamados: "Pedido de nota (venda)" é a única distinção que o banco guarda;
 * - periodo: hoje | 7d | 30d (pela data em que a demanda foi aberta);
 * - demanda: id da demanda aberta no painel lateral.
 */

import { valorParam, type ParamsBusca } from './tabela-url';

export type StatusFiltro = 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'concluido';
export type TipoFiltro = 'venda' | 'outras';
export type PeriodoFiltro = 'hoje' | '7d' | '30d';

export type FiltrosDemandas = {
  setor: string;
  status: StatusFiltro | null;
  /** 'eu', 'sem' ou o id de uma pessoa. */
  responsavel: string | null;
  tipo: TipoFiltro | null;
  periodo: PeriodoFiltro | null;
  demanda: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (v: string | null | undefined): v is string => !!v && UUID.test(v);

export const OPCOES_STATUS: { valor: StatusFiltro; rotulo: string }[] = [
  { valor: 'aberto', rotulo: 'Aberta' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'aguardando_cliente', rotulo: 'Aguardando cliente' },
  { valor: 'concluido', rotulo: 'Concluída' },
];
export const OPCOES_TIPO: { valor: TipoFiltro; rotulo: string }[] = [
  { valor: 'venda', rotulo: 'Pedido de nota (venda)' },
  { valor: 'outras', rotulo: 'Outras' },
];
export const OPCOES_PERIODO: { valor: PeriodoFiltro; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
];

function daLista<T extends string>(v: string | undefined, opcoes: { valor: T }[]): T | null {
  return opcoes.find((o) => o.valor === v)?.valor ?? null;
}

/** Valores estranhos na URL viram "sem filtro" (nunca vão para a consulta). */
export function lerFiltrosDemandas(params: ParamsBusca): FiltrosDemandas {
  const setor = valorParam(params, 'setor');
  const responsavel = valorParam(params, 'responsavel');
  const demanda = valorParam(params, 'demanda');
  return {
    setor: setor === 'triagem' || ehUuid(setor) ? setor : 'todos',
    status: daLista(valorParam(params, 'status'), OPCOES_STATUS),
    responsavel: responsavel === 'eu' || responsavel === 'sem' || ehUuid(responsavel) ? responsavel : null,
    tipo: daLista(valorParam(params, 'tipo'), OPCOES_TIPO),
    periodo: daLista(valorParam(params, 'periodo'), OPCOES_PERIODO),
    demanda: ehUuid(demanda) ? demanda : null,
  };
}

/** Algum filtro além do setor? (A exportação do CSV do Bling respeita só o setor.) */
export function temFiltroAlemDoSetor(f: FiltrosDemandas): boolean {
  return Boolean(f.status || f.responsavel || f.tipo || f.periodo);
}

/** Início do dia (00:00) no horário de Brasília, como o trabalhador calcula (Brasil sem horário de verão). */
export function inicioDoDiaSP(agora: Date): Date {
  const data = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
  return new Date(`${data}T00:00:00-03:00`);
}

/** Desde quando vale o período: hoje = desde 00:00 de Brasília; 7d/30d = as últimas 7×24 h / 30×24 h. */
export function inicioDoPeriodo(periodo: PeriodoFiltro | null, agora: Date): string | null {
  if (!periodo) return null;
  if (periodo === 'hoje') return inicioDoDiaSP(agora).toISOString();
  const dias = periodo === '7d' ? 7 : 30;
  return new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000).toISOString();
}
