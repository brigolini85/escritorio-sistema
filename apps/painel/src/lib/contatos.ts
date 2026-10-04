// Contatos (spec 7C.2): filtros da URL e da consulta à visão contatos_lista, selos da linha e textos do último contato, da
// conversa e do resumo do WhatsApp. Sem React e sem banco: testável.
import { minutosDeEspera, textoEspera } from './atendimento';
import { termoSeguroPostgrest } from './busca';
import { inicioDoPeriodo } from './demandas';
import { FUSO } from './formatos';
import { valorParam, type Ordem, type ParamsBusca } from './tabela-url';

export const FILTROS_RAPIDOS = [
  { valor: 'desligado', rotulo: 'Agente desligado' },
  { valor: 'sem_empresa', rotulo: 'Sem empresa' },
  { valor: 'nota', rotulo: 'Pode pedir nota' },
  { valor: 'preco', rotulo: 'Muda preço' },
] as const;
export type FiltroRapido = (typeof FILTROS_RAPIDOS)[number]['valor'];

export const PERIODOS_CONTATO = [
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7d', rotulo: 'Últimos 7 dias' },
  { valor: '30d', rotulo: 'Últimos 30 dias' },
  { valor: 'antigo', rotulo: 'Há mais de 30 dias' },
  { valor: 'nunca', rotulo: 'Sem conversa' },
] as const;
export type PeriodoContato = (typeof PERIODOS_CONTATO)[number]['valor'];

export const ORDENS_CONTATOS = ['nome', 'ultimo'] as const;
/** Mais recente primeiro; sem conversa no fim (D19). */
export const ORDEM_PADRAO_CONTATOS: Ordem = { coluna: 'ultimo', direcao: 'desc' };

export type FiltrosContatos = { q: string | null; rapido: FiltroRapido | null; empresa: string | null; periodo: PeriodoContato | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const daLista = <T extends string>(v: string | undefined, lista: readonly { valor: T }[]): T | null => lista.find((o) => o.valor === v)?.valor ?? null;

/** ?q= (busca), ?filtro= (um filtro rápido, D4), ?empresa= (id) e ?periodo= (D13). */
export function lerFiltrosContatos(params: ParamsBusca): FiltrosContatos {
  const empresa = valorParam(params, 'empresa');
  return {
    q: termoSeguroPostgrest(valorParam(params, 'q')) || null,
    rapido: daLista(valorParam(params, 'filtro'), FILTROS_RAPIDOS),
    empresa: empresa && UUID.test(empresa) ? empresa : null,
    periodo: daLista(valorParam(params, 'periodo'), PERIODOS_CONTATO),
  };
}

export const temFiltroContatos = (f: FiltrosContatos): boolean => Boolean(f.q || f.rapido || f.empresa || f.periodo);

/** O que os filtros usam do construtor de consultas do PostgREST. */
export type ConsultaContatos<Q> = {
  eq(coluna: string, valor: boolean | number | string): Q;
  is(coluna: string, valor: null): Q;
  contains(coluna: string, valor: string[]): Q;
  gte(coluna: string, valor: string): Q;
  lt(coluna: string, valor: string): Q;
  or(filtros: string): Q;
};

const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

/** Nome, telefone (pelos dígitos digitados) ou empresa ativa — razão social e nome fantasia (D20). */
export function filtroBusca(q: string): string {
  const digitos = q.replace(/\D/g, '');
  return [`nome.ilike.%${q}%`, `telefone.ilike.%${digitos || q}%`, `empresas_busca.ilike.%${q}%`].join(',');
}

/**
 * Filtros da URL numa consulta a contatos_lista. `rapido` à parte: cada contagem dos filtros rápidos aplica a busca, a empresa
 * e o período, e o seu próprio filtro rápido (D4).
 */
export function aplicarFiltrosContatos<Q extends ConsultaContatos<Q>>(q: Q, f: FiltrosContatos, agora: Date, rapido: FiltroRapido | null = f.rapido): Q {
  // Arquivado sai da lista (spec 5.1).
  let r = q.eq('ativo', true);
  if (f.q) r = r.or(filtroBusca(f.q));
  if (rapido === 'desligado') r = r.eq('agente_pausado', true);
  else if (rapido === 'sem_empresa') r = r.eq('n_empresas', 0);
  else if (rapido === 'nota') r = r.eq('pode_pedir_nota_alguma', true);
  else if (rapido === 'preco') r = r.eq('muda_preco_alguma', true);
  if (f.empresa) r = r.contains('empresa_ids', [f.empresa]);
  const periodo = f.periodo;
  if (periodo === 'nunca') r = r.is('ultimo_contato_em', null);
  else if (periodo === 'antigo') r = r.lt('ultimo_contato_em', new Date(agora.getTime() - TRINTA_DIAS_MS).toISOString());
  else if (periodo) r = r.gte('ultimo_contato_em', inicioDoPeriodo(periodo, agora)!);
  return r;
}

export type Vinculo = { empresaId: string; empresa: string; podePedirNota: boolean; podeMudarPreco: boolean };

/** Nome da empresa como a equipe conhece (fantasia, senão razão social). */
export const nomeEmpresa = (c: { razao_social: string; nome_fantasia: string | null }): string => c.nome_fantasia || c.razao_social;

/** `empresas` (jsonb) da visão: [{id, nome, pode_pedir_nota, pode_atualizar_preco}]; o que vier estranho fica de fora. */
export function lerEmpresasDaVisao(v: unknown): Vinculo[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((e) => {
    const o = e as { id?: unknown; nome?: unknown; pode_pedir_nota?: unknown; pode_atualizar_preco?: unknown } | null;
    return o && typeof o.id === 'string' && typeof o.nome === 'string'
      ? [{ empresaId: o.id, empresa: o.nome, podePedirNota: o.pode_pedir_nota === true, podeMudarPreco: o.pode_atualizar_preco === true }]
      : [];
  });
}

export type Selo = { rotulo: string; tom: 'nota' | 'preco' | 'conversa'; titulo: string };

/** Selos da linha (imagem A, D11): " · 1 de 2" quando vale só em parte das empresas; "Só conversa" sem marcação; nada sem empresa. */
export function selosDoContato(vinculos: Vinculo[]): Selo[] {
  if (vinculos.length === 0) return [];
  const selo = (rotulo: string, tom: Selo['tom'], com: Vinculo[]): Selo[] => {
    if (com.length === 0) return [];
    const parcial = com.length < vinculos.length ? ` · ${com.length} de ${vinculos.length}` : '';
    return [{ rotulo: `${rotulo}${parcial}`, tom, titulo: `Em: ${com.map((x) => x.empresa).join(', ')}` }];
  };
  const selos = [
    ...selo('Pede nota', 'nota', vinculos.filter((x) => x.podePedirNota)),
    ...selo('Muda preço e cadastra produto', 'preco', vinculos.filter((x) => x.podeMudarPreco)),
  ];
  return selos.length > 0 ? selos : [{ rotulo: 'Só conversa', tom: 'conversa', titulo: 'Não pede nota nem muda preço' }];
}

const dia = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });
const hora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const anoDe = (d: Date) => dia.format(d).split('/')[2];

/** "hoje 14:48", "ontem 16:40", "29/09 15:20" (mesmo ano), "30/12/2025" (outro ano) ou "—" (sem conversa visível). */
export function textoUltimoContato(iso: string | null, agora: Date): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const h = hora.format(d);
  if (dia.format(d) === dia.format(agora)) return `hoje ${h}`;
  if (dia.format(d) === dia.format(new Date(agora.getTime() - 86_400_000))) return `ontem ${h}`;
  const [dd, mm, aaaa] = dia.format(d).split('/');
  return aaaa === anoDe(agora) ? `${dd}/${mm} ${h}` : `${dd}/${mm}/${aaaa}`;
}

/** "cadastro em 14/03" (o ano só quando não é o corrente). */
export function textoCadastro(iso: string, agora: Date): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const [dd, mm, aaaa] = dia.format(d).split('/');
  return `cadastro em ${dd}/${mm}${aaaa === anoDe(agora) ? '' : `/${aaaa}`}`;
}

export type ConversaDoContato = {
  conversaId: string | null; estado: 'agente' | 'humano' | null; atendenteId: string | null; atendenteNome: string | null; esperaDesde: string | null;
};
export type TomConversa = 'espera' | 'pessoa' | 'agente' | 'sem';

/** Uma linha da tabela: o contato, as empresas ativas e a conversa que a pessoa vê. */
export type LinhaContato = ConversaDoContato & {
  id: string; nome: string; telefone: string; agentePausado: boolean; vinculos: Vinculo[]; ultimoEm: string | null;
};

/**
 * Estado de agora da conversa (D15). Sem conversa: quem vê todas as conversas lê "sem conversa"; os outros, "nenhuma conversa
 * visível" — a regra de leitura pode esconder uma que existe (D2).
 */
export function estadoDaConversa(c: ConversaDoContato, ctx: { euId: string; veTodas: boolean }): { texto: string; tom: TomConversa } {
  if (!c.conversaId) return { texto: ctx.veTodas ? 'sem conversa' : 'nenhuma conversa visível', tom: 'sem' };
  if (c.esperaDesde) return { texto: 'esperando pessoa', tom: 'espera' };
  if (c.estado === 'humano') {
    const quem = c.atendenteId === ctx.euId ? 'você' : (c.atendenteNome?.trim().split(/\s+/)[0] || 'a equipe');
    return { texto: `com ${quem}`, tom: 'pessoa' };
  }
  return { texto: 'com o agente', tom: 'agente' };
}

/** "esperando pessoa · 18 min" (bloco WhatsApp do painel); os outros estados sem tempo. */
export function textoConversaAgora(c: ConversaDoContato, ctx: { euId: string; veTodas: boolean }, agora: Date): string {
  const e = estadoDaConversa(c, ctx);
  return e.tom === 'espera' && c.esperaDesde ? `${e.texto} · ${textoEspera(minutosDeEspera(c.esperaDesde, agora.getTime()))}` : e.texto;
}

export type ResumoWhatsapp = { atendimentos: number; resolvidas: number };

/** contato_whatsapp_resumo(); qualquer coisa estranha vira null (o painel mostra "—"). */
export function lerResumoWhatsapp(v: unknown): ResumoWhatsapp | null {
  const o = v as { atendimentos?: unknown; resolvidas_agente?: unknown } | null;
  if (!o || typeof o.atendimentos !== 'number' || typeof o.resolvidas_agente !== 'number') return null;
  if (o.atendimentos < 0 || o.resolvidas_agente < 0 || o.resolvidas_agente > o.atendimentos) return null;
  return { atendimentos: o.atendimentos, resolvidas: o.resolvidas_agente };
}

export const textoResolvidas = (r: ResumoWhatsapp | null): string =>
  (r && r.atendimentos > 0 ? `${Math.round((100 * r.resolvidas) / r.atendimentos)}%` : '—');

export function textoAtendimentos(r: ResumoWhatsapp | null): string | null {
  if (!r) return null;
  return r.atendimentos === 1 ? '1 atendimento' : `${r.atendimentos} atendimentos`;
}

export const hrefConversa = (id: string): string => `/atendimento/${id}`;
