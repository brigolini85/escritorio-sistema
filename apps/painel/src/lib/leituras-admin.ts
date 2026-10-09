// Leituras de custo, configuração e sinais de vida (só o administrador lê: banco e RLS). Ficam fora de lib/inicio.ts
// e lib/contadores.ts para a Minha mesa e os componentes de cliente nunca importarem leitor de custo (D1, Restrições
// globais da G2). server-only: o navegador nunca recebe este módulo.
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@escritorio/db';
import { mesCorrenteSP, type GastoDoMes, type SinaisVida } from './inicio';

type Cliente = SupabaseClient<Database>;

/** Gasto de IA do mês corrente (Brasília) pela gastos_resumo (só o administrador; os outros recebem null). */
export async function lerGastoIaDoMes(sb: Cliente, agora: Date): Promise<GastoDoMes | null> {
  const { inicio, fim } = mesCorrenteSP(agora);
  const { data, error } = await sb.rpc('gastos_resumo', { p_de: inicio, p_ate: fim });
  if (error || !data) return null;
  return { total: Number((data as { total_usd: number }).total_usd) || 0 };
}

/** sinais_vida por componente. null quando não dá para ler (só o administrador lê). */
export async function lerSinaisVida(sb: Cliente): Promise<SinaisVida | null> {
  const { data, error } = await sb.from('sinais_vida').select('componente, visto_em');
  if (error || !data) return null;
  const de = (c: string) => data.find((l) => l.componente === c)?.visto_em ?? null;
  const ultimo = data.reduce<string | null>((m, l) => (!m || new Date(l.visto_em) > new Date(m) ? l.visto_em : m), null);
  return { fila: de('fila'), whatsapp: de('whatsapp'), ultimo };
}

/** Estado geral do agente (configuracoes.agente_pausado). null quando o RLS não deixa ler (só administrador lê). */
export async function lerAgentePausado(sb: Cliente): Promise<boolean | null> {
  const { data, error } = await sb.from('configuracoes').select('agente_pausado').eq('id', 1).maybeSingle();
  if (error || !data) return null;
  return data.agente_pausado;
}

/** Auditoria 3.13: o ambiente do banco (gravado pelo trabalhador na primeira partida). null sem valor ou sem leitura. */
export async function lerAmbienteDoBanco(sb: Cliente): Promise<string | null> {
  const { data, error } = await sb.from('configuracoes').select('ambiente').eq('id', 1).maybeSingle();
  if (error || !data) return null;
  return data.ambiente;
}
