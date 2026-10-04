import 'server-only';
import { cache } from 'react';
import type { LinhaAtendimento } from '@/lib/atendimento';
import { inicioDoDiaSP } from '@/lib/demandas';
import { lerEstadoSistema } from '@/lib/inicio';
import { lerDemandasMesa } from '@/lib/minha-mesa';
import { paginaInicio } from './dados-inicio';

// Leituras da Minha mesa. Nada aqui lê configuracoes, sinais_vida, uso_ia nem gastos (Restrições globais): o estado do
// sistema vem só de estado_sistema_resumo (sem custos). Tudo passa pela RLS da pessoa (D13).

const UM_DIA_MS = 24 * 60 * 60 * 1000;
const COLUNAS = 'id, numero, titulo, empresa, setor, status, prioridade, prazo_em, prazo_pausado_desde, vencida';

/** Minhas demandas abertas (até 50): a que vence primeiro em cima; sem prazo por último. */
export const lerMinhasDemandas = cache(async (usuarioId: string) => {
  const { sb } = await paginaInicio();
  const { data, count, error } = await sb.from('demandas_lista').select(COLUNAS, { count: 'exact' })
    .eq('responsavel_id', usuarioId).neq('status', 'concluido')
    .order('prazo_em', { ascending: true, nullsFirst: false }).order('numero', { ascending: true }).limit(50);
  if (error) console.error('[inicio] falha ao ler as minhas demandas', error);
  return error ? null : { lista: lerDemandasMesa(data), total: count ?? 0 };
});

/** "minhas vencidas" e "vencem hoje" exatos (a lista acima tem limite), com a mesma regra dos grupos (D11). */
export const contarMinhas = cache(async (usuarioId: string) => {
  const { sb, agora } = await paginaInicio();
  const fim = new Date(inicioDoDiaSP(agora).getTime() + UM_DIA_MS).toISOString();
  const base = () => sb.from('demandas_lista').select('id', { count: 'exact', head: true }).eq('responsavel_id', usuarioId).neq('status', 'concluido');
  const [vencidas, hoje] = await Promise.all([
    base().is('vencida', true),
    base().is('prazo_pausado_desde', null).gte('prazo_em', agora.toISOString()).lt('prazo_em', fim),
  ]);
  if (vencidas.error) console.error('[inicio] falha ao contar as minhas vencidas', vencidas.error);
  if (hoje.error) console.error('[inicio] falha ao contar as minhas que vencem hoje', hoje.error);
  return { vencidas: vencidas.error ? null : vencidas.count ?? 0, hoje: hoje.error ? null : hoje.count ?? 0 };
});

/** Sem responsável nos setores da pessoa (D13). `chave` = ids dos setores separados por vírgula (cache por valor). */
export const lerSemResponsavelMesa = cache(async (chave: string) => {
  if (!chave) return { lista: [], total: 0 };
  const { sb } = await paginaInicio();
  const { data, count, error } = await sb.from('demandas_lista').select(COLUNAS, { count: 'exact' })
    .is('responsavel_id', null).neq('status', 'concluido').in('setor_id', chave.split(','))
    .order('prazo_em', { ascending: true, nullsFirst: false }).limit(10);
  if (error) console.error('[inicio] falha ao ler as sem responsável dos meus setores', error);
  return error ? null : { lista: lerDemandasMesa(data), total: count ?? 0 };
});

/** Demandas distintas que a pessoa concluiu desde 00:00 de Brasília (D15). */
export const contarConcluidasHoje = cache(async (usuarioId: string) => {
  const { sb, agora } = await paginaInicio();
  const { data, error } = await sb.from('chamado_eventos').select('chamado_id')
    .eq('tipo', 'conclusao').eq('usuario_id', usuarioId).gte('criado_em', inicioDoDiaSP(agora).toISOString());
  if (error) console.error('[inicio] falha ao contar as concluídas de hoje', error);
  return error ? null : new Set((data ?? []).map((e) => e.chamado_id)).size;
});

/** Nomes dos setores da pessoa, para "seus setores: Pessoal e Fiscal". */
export const lerNomesDosMeusSetores = cache(async (chave: string) => {
  if (!chave) return [];
  const { sb } = await paginaInicio();
  const { data, error } = await sb.from('setores').select('nome').in('id', chave.split(',')).order('nome');
  if (error) console.error('[inicio] falha ao ler os nomes dos meus setores', error);
  return (data ?? []).map((s) => s.nome);
});

/** Conversas esperando você (a mesma conta do menu), quem espera há mais tempo primeiro. */
export const lerEsperandoVoce = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, count, error } = await sb.from('caixa_entrada').select('*', { count: 'exact' })
    .eq('esperando_voce', true).order('espera_desde', { ascending: true }).limit(5);
  if (error) console.error('[inicio] falha ao ler as conversas esperando você', error);
  return error ? null : { linhas: (data ?? []) as unknown as LinhaAtendimento[], total: count ?? 0 };
});

/** "N com o agente hoje" (D16): com o agente, sem espera, com mensagem hoje. */
export const contarComAgenteHoje = cache(async () => {
  const { sb, agora } = await paginaInicio();
  const { count, error } = await sb.from('caixa_entrada').select('id', { count: 'exact', head: true })
    .eq('estado', 'agente').eq('esperando_pessoa', false).gte('ultima_em', inicioDoDiaSP(agora).toISOString());
  if (error) console.error('[inicio] falha ao contar as conversas com o agente hoje', error);
  return error ? null : count ?? 0;
});

/** estado_sistema_resumo (Task 1): só booleanos; null fora do horário ou sem a migração (D21). */
export const lerEstadoSistemaMesa = cache(async () => {
  const { sb } = await paginaInicio();
  const { data, error } = await sb.rpc('estado_sistema_resumo');
  if (error) console.error('[inicio] falha ao ler estado_sistema_resumo', error);
  return error ? null : lerEstadoSistema(data);
});
