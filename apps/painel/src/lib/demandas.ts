/**
 * Filtros da tela Gestão das demandas (só leitura da URL). Valem iguais para a tabela, o quadro, os contadores e o CSV do Bling
 * (lib/demandas-consulta.ts os aplica na consulta):
 * - setor: todos | triagem | id do setor (o parâmetro de sempre);
 * - status: lista separada por vírgula (aberto, em_andamento, aguardando_cliente, concluido); sem ele, as três abertas;
 * - origem: agente (WhatsApp) | equipe; vencidas: 1; prazo: hoje (vencem hoje);
 * - responsavel: eu | sem | id; prioridade; tipo: venda | outras; periodo: hoje | 7d | 30d (pela abertura);
 * - q: busca (nº, empresa, título ou descrição); demanda: id aberto no painel lateral; nova: 1 abre a nova demanda.
 */
import { valorParam, type Ordem, type ParamsBusca } from './tabela-url';

export type StatusFiltro = 'aberto' | 'em_andamento' | 'aguardando_cliente' | 'concluido';
export type Prioridade = 'baixa' | 'normal' | 'alta' | 'urgente';
export type OrigemFiltro = 'agente' | 'equipe';
export type TipoFiltro = 'venda' | 'outras';
export type PeriodoFiltro = 'hoje' | '7d' | '30d';
export type Visao = 'tabela' | 'quadro';

export type FiltrosDemandas = {
  setor: string;
  status: StatusFiltro[];
  origem: OrigemFiltro | null;
  vencidas: boolean;
  prazoHoje: boolean;
  /** 'eu', 'sem' ou o id de uma pessoa. */
  responsavel: string | null;
  prioridade: Prioridade | null;
  tipo: TipoFiltro | null;
  periodo: PeriodoFiltro | null;
  q: string | null;
  demanda: string | null;
  nova: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const ehUuid = (v: string | null | undefined): v is string => !!v && UUID.test(v);

/** Botões de status (plural, imagem 03). O status na demanda usa ROTULO_STATUS (singular). */
export const OPCOES_STATUS: { valor: StatusFiltro; rotulo: string }[] = [
  { valor: 'aberto', rotulo: 'Novas' },
  { valor: 'em_andamento', rotulo: 'Resolvendo' },
  { valor: 'aguardando_cliente', rotulo: 'Com o cliente' },
  { valor: 'concluido', rotulo: 'Concluídas' },
];
export const ROTULO_STATUS: Record<StatusFiltro, string> = { aberto: 'Nova', em_andamento: 'Resolvendo', aguardando_cliente: 'Com o cliente', concluido: 'Concluída' };
/** Sem ?status=: Novas, Resolvendo e Com o cliente (imagem 03). */
export const STATUS_PADRAO: StatusFiltro[] = ['aberto', 'em_andamento', 'aguardando_cliente'];
export const OPCOES_ORIGEM: { valor: OrigemFiltro; rotulo: string }[] = [
  { valor: 'agente', rotulo: 'Do agente' },
  { valor: 'equipe', rotulo: 'Da equipe' },
];
export const OPCOES_PRIORIDADE: { valor: Prioridade; rotulo: string }[] = [
  { valor: 'baixa', rotulo: 'Baixa' },
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'alta', rotulo: 'Alta' },
  { valor: 'urgente', rotulo: 'Urgente' },
];
export const ROTULO_PRIORIDADE = Object.fromEntries(OPCOES_PRIORIDADE.map((o) => [o.valor, o.rotulo])) as Record<Prioridade, string>;
export const OPCOES_TIPO: { valor: TipoFiltro; rotulo: string }[] = [
  { valor: 'venda', rotulo: 'Pedido de nota (venda)' },
  { valor: 'outras', rotulo: 'Outras' },
];
export const OPCOES_PERIODO: { valor: PeriodoFiltro; rotulo: string }[] = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
];

/** Ordenação (decisão 12): o seletor "Ordenar" mostra estas, cada uma com a direção que faz sentido primeiro. */
export const ORDENS: { coluna: string; rotulo: string; direcao: 'asc' | 'desc' }[] = [
  { coluna: 'atualizacao', rotulo: 'Última atualização', direcao: 'desc' },
  { coluna: 'prazo', rotulo: 'Prazo', direcao: 'asc' },
  { coluna: 'prioridade', rotulo: 'Prioridade', direcao: 'desc' },
  { coluna: 'numero', rotulo: 'Número', direcao: 'desc' },
];
export const ORDEM_PADRAO: Ordem = { coluna: 'atualizacao', direcao: 'desc' };
export const COLUNA_DA_ORDEM: Record<string, string> = { atualizacao: 'atualizado_em', prazo: 'prazo_em', prioridade: 'prioridade', numero: 'numero' };

const MAXIMO_BUSCA = 80;

function daLista<T extends string>(v: string | undefined, opcoes: { valor: T }[]): T | null {
  return opcoes.find((o) => o.valor === v)?.valor ?? null;
}

/** Valores estranhos na URL viram "sem filtro" (nunca vão para a consulta). O próprio id em ?responsavel= vira "eu". */
export function lerFiltrosDemandas(params: ParamsBusca, eu?: string): FiltrosDemandas {
  const setor = valorParam(params, 'setor');
  const bruto = valorParam(params, 'responsavel');
  const responsavel = eu && bruto === eu ? 'eu' : bruto;
  const demanda = valorParam(params, 'demanda');
  const pedidos = (valorParam(params, 'status') ?? '').split(',').map((s) => s.trim());
  const status = OPCOES_STATUS.map((o) => o.valor).filter((v) => pedidos.includes(v));
  const q = (valorParam(params, 'q') ?? '').trim().slice(0, MAXIMO_BUSCA);
  return {
    setor: setor === 'triagem' || ehUuid(setor) ? setor : 'todos',
    status: status.length ? status : [...STATUS_PADRAO],
    origem: daLista(valorParam(params, 'origem'), OPCOES_ORIGEM),
    vencidas: valorParam(params, 'vencidas') === '1',
    prazoHoje: valorParam(params, 'prazo') === 'hoje',
    responsavel: responsavel === 'eu' || responsavel === 'sem' || ehUuid(responsavel) ? responsavel : null,
    prioridade: daLista(valorParam(params, 'prioridade'), OPCOES_PRIORIDADE),
    tipo: daLista(valorParam(params, 'tipo'), OPCOES_TIPO),
    periodo: daLista(valorParam(params, 'periodo'), OPCOES_PERIODO),
    q: q || null,
    demanda: ehUuid(demanda) ? demanda : null,
    nova: valorParam(params, 'nova') === '1',
  };
}

export function ehStatusPadrao(s: StatusFiltro[]): boolean {
  return s.length === STATUS_PADRAO.length && STATUS_PADRAO.every((x) => s.includes(x));
}

/** ?status= depois de clicar num botão de status. null tira o parâmetro (volta ao padrão, também quando fica vazio). */
export function statusAoAlternar(atual: StatusFiltro[], s: StatusFiltro): string | null {
  const novo = atual.includes(s) ? atual.filter((x) => x !== s) : [...atual, s];
  const ordenado = OPCOES_STATUS.map((o) => o.valor).filter((v) => novo.includes(v));
  if (ordenado.length === 0 || ehStatusPadrao(ordenado)) return null;
  return ordenado.join(',');
}

/** Algum filtro além do padrão? (O estado vazio oferece "Limpar filtros".) */
export function temFiltro(f: FiltrosDemandas): boolean {
  return f.setor !== 'todos' || !ehStatusPadrao(f.status)
    || Boolean(f.origem || f.vencidas || f.prazoHoje || f.responsavel || f.prioridade || f.tipo || f.periodo || f.q);
}

/** Etiquetas removíveis dos filtros avançados (imagem 03: "Setor: Fiscal ×"). `param` é o que o × tira da URL. */
export function etiquetasFiltros(
  f: FiltrosDemandas,
  nomes: { setores: { id: string; nome: string }[]; pessoas: { id: string; nome: string; ativo: boolean }[] },
): { param: string; rotulo: string }[] {
  const e: { param: string; rotulo: string }[] = [];
  if (f.setor !== 'todos') {
    e.push({ param: 'setor', rotulo: `Setor: ${f.setor === 'triagem' ? 'Triagem' : nomes.setores.find((s) => s.id === f.setor)?.nome ?? 'escolhido'}` });
  }
  if (f.responsavel) {
    const p = nomes.pessoas.find((x) => x.id === f.responsavel);
    const nome = f.responsavel === 'eu' ? 'eu' : f.responsavel === 'sem' ? 'ninguém' : p ? (p.ativo ? p.nome : `${p.nome} (arquivado)`) : 'escolhido';
    e.push({ param: 'responsavel', rotulo: `Responsável: ${nome}` });
  }
  if (f.prioridade) e.push({ param: 'prioridade', rotulo: `Prioridade: ${ROTULO_PRIORIDADE[f.prioridade]}` });
  if (f.tipo) e.push({ param: 'tipo', rotulo: `Tipo: ${OPCOES_TIPO.find((o) => o.valor === f.tipo)!.rotulo}` });
  if (f.periodo) e.push({ param: 'periodo', rotulo: `Aberta: ${OPCOES_PERIODO.find((o) => o.valor === f.periodo)!.rotulo}` });
  if (f.prazoHoje) e.push({ param: 'prazo', rotulo: 'Prazo: vence hoje' });
  return e;
}

/** Iniciais do avatar do cartão (imagem 04: "AN"). */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toLocaleUpperCase('pt-BR');
  return `${partes[0]![0]}${partes[partes.length - 1]![0]}`.toLocaleUpperCase('pt-BR');
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

/**
 * Pessoas do filtro Responsável. Arquivada sai da seleção (spec 5.1), exceto a que já está no filtro da URL
 * (senão o Select pareceria "Qualquer um"); essa aparece como "(arquivado)", o nome do estado no painel.
 */
export function opcoesResponsavel(pessoas: { id: string; nome: string; ativo: boolean }[], euId: string, filtro: string | null) {
  return pessoas.filter((p) => p.id !== euId && (p.ativo || p.id === filtro))
    .map((p) => ({ valor: p.id, rotulo: p.ativo ? p.nome : `${p.nome} (arquivado)` }));
}
