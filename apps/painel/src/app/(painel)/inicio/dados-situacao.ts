import 'server-only';
import { cache } from 'react';
import { inicioDoDiaSP } from '@/lib/demandas';
import { diaSP } from '@/lib/inicio';
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
  const { sb } = await paginaInicio();
  const { data, error } = await sb.rpc('agente_numeros_hoje');
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
