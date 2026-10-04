import 'server-only';
import { cache } from 'react';
import type { LinhaAtendimento } from '@/lib/atendimento';
import { inicioDoDiaSP } from '@/lib/demandas';
import { diaSP, lerLinhasSetor } from '@/lib/inicio';
import { lerSinaisVida } from '@/lib/leituras-admin';
import { gastoDoMes } from './gasto-do-mes';
import { paginaInicio } from './dados-inicio';

// Leituras do Painel de situação. Gasto, configuracoes e sinais_vida só o administrador lê (banco e RLS); a Minha mesa
// nunca importa este arquivo (D1, Restrições globais). Cada leitor roda uma vez por requisição (cache).

/**
 * Só colunas da base (antes da Parte F): na homologação sem as migrações novas a leitura não falha e o PAUSAR/RETOMAR,
 * o aviso do teto e o prazo do alerta de fila continuam (D21). Colunas novas vão em leitores à parte (lerCotacaoSituacao).
 */
export const lerConfigSituacao = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, error } = await sb.from('configuracoes')
    .select('agente_pausado, teto_ia_usd, minutos_alerta_fila, horario_inicio, horario_fim, dias_uteis')
    .eq('id', 1).maybeSingle();
  if (error) console.error('[inicio] falha ao ler configuracoes', error);
  return data;
});

/** Cotação US$→R$ (coluna da Parte F). Pode faltar na homologação: null, e o cartão do gasto mostra só em dólar. */
export const lerCotacaoSituacao = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, error } = await sb.from('configuracoes').select('cotacao_usd_brl').eq('id', 1).maybeSingle();
  return error || !data?.cotacao_usd_brl ? null : Number(data.cotacao_usd_brl);
});

/** teto_atingido da estado_sistema_resumo (sem valores): para o cartão do agente quando o gasto não pôde ser lido. */
export const lerTetoAtingidoResumo = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, error } = await sb.rpc('estado_sistema_resumo');
  const teto = !error && data && typeof data === 'object' ? (data as { teto_atingido?: unknown }).teto_atingido : null;
  return typeof teto === 'boolean' ? teto : null;
});

export const lerSinaisSituacao = cache(async () => lerSinaisVida((await paginaInicio()).sb));

export const lerGastoSituacao = cache(async (usuarioId: string) => {
  const { sb, agora } = await paginaInicio();
  return gastoDoMes(sb, usuarioId, agora);
});

/** agente_numeros_hoje (Task 1); null sem a migração (homologação antes do "ok", D21). */
export const lerNumerosAgente = cache(async () => {
  const { sb, agora } = await paginaInicio();
  const { data, error } = await sb.rpc('agente_numeros_hoje', { p_agora: agora.toISOString() });
  if (error || !data) return null;
  const o = data as { conversas?: unknown; resolvidas_agente?: unknown };
  return { conversas: Number(o.conversas) || 0, resolvidas: Number(o.resolvidas_agente) || 0 };
});

/** Demandas criadas hoje (Brasília) e quantas delas o agente abriu (origem agente/sistema, como o filtro "Do agente", D7). */
export const lerDemandasDoDia = cache(async () => {
  const { sb, agora } = await paginaInicio();
  const desde = inicioDoDiaSP(agora).toISOString();
  const base = () => sb.from('chamados').select('id', { count: 'exact', head: true }).gte('criado_em', desde);
  const [todas, doAgente] = await Promise.all([base(), base().in('origem', ['agente', 'sistema'])]);
  if (todas.error || doAgente.error) return null;
  return { abertasHoje: todas.count ?? 0, doAgente: doAgente.count ?? 0 };
});

/** O feriado de hoje, se houver, para "dentro do expediente" (D8). */
export const lerFeriadosDeHoje = cache(async () => {
  const { sb, agora } = await paginaInicio();
  const hoje = diaSP(agora);
  const { data, error } = await sb.from('feriados').select('data').eq('data', hoje);
  if (error) console.error('[inicio] falha ao ler feriados', error);
  return (data ?? []).map((f) => String(f.data));
});

const UM_DIA_MS = 24 * 60 * 60 * 1000;

/** demandas_por_setor (Task 1): os cinco números são a soma das linhas (D5). null sem a migração (D21). */
export const lerSetoresSituacao = cache(async () => {
  const { sb, agora } = await paginaInicio();
  // O mesmo instante das outras leituras da página (vencem hoje, sem responsável antigas), não o now() do banco.
  const { data, error } = await sb.rpc('demandas_por_setor', { p_agora: agora.toISOString() });
  if (error && error.code !== 'PGRST202') console.error('[inicio] falha ao ler as demandas por setor', error);
  return error ? null : lerLinhasSetor(data);
});

/** Conversas com espera em aberto (D6), quem espera há mais tempo primeiro: o número, o detalhe e a lista. */
export const lerEsperandoSituacao = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, count, error } = await sb.from('caixa_entrada').select('*', { count: 'exact' })
    .not('espera_desde', 'is', null).order('espera_desde', { ascending: true }).limit(5);
  return error ? null : { linhas: (data ?? []) as unknown as LinhaAtendimento[], total: count ?? 0 };
});

/** As cinco vencidas mais antigas (a primeira dá o "mais atrasada", D9). */
export const lerVencidasSituacao = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, error } = await sb.from('demandas_lista')
    .select('id, numero, titulo, empresa, setor, responsavel, prazo_em, prazo_pausado_desde')
    .is('vencida', true).order('prazo_em', { ascending: true }).limit(5);
  if (error) console.error('[inicio] falha ao ler as vencidas', error);
  return error ? null : data ?? [];
});

/** Prioridade e prazo das que ainda vencem hoje, para "2 urgentes · até 18h". */
export const lerVencemHojeSituacao = cache(async () => {
  const { sb, agora } = await paginaInicio();
  const fim = new Date(inicioDoDiaSP(agora).getTime() + UM_DIA_MS).toISOString();
  const { data, error } = await sb.from('demandas_lista').select('prioridade, prazo_em')
    .neq('status', 'concluido').is('prazo_pausado_desde', null).gte('prazo_em', agora.toISOString()).lt('prazo_em', fim).limit(500);
  if (error) console.error('[inicio] falha ao ler as que vencem hoje', error);
  return error ? null : data ?? [];
});

/** Sem responsável há mais que o prazo do alerta de fila (Configurações › Teto de IA e alertas). */
export const contarSemResponsavelAntigas = cache(async (minutos: number) => {
  const { sb, agora } = await paginaInicio();
  const limite = new Date(agora.getTime() - minutos * 60_000).toISOString();
  const { count, error } = await sb.from('chamados').select('id', { count: 'exact', head: true })
    .neq('status', 'concluido').is('responsavel_id', null).lt('criado_em', limite);
  if (error) console.error('[inicio] falha ao contar as sem responsável antigas', error);
  return error ? null : count ?? 0;
});
