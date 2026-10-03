// Leituras e regras do Início (D1): sinais de vida, gasto de IA do mês vs. teto e a faixa de alertas.
// Tudo pelo cliente do usuário: gastos_resumo, sinais_vida e configuracoes só o administrador lê (banco e RLS);
// para as outras pessoas as leituras voltam null e os cartões correspondentes não aparecem.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@escritorio/db';
import { formatarUSD, tempoRelativo } from './formatos';
import { situacaoDoSinal, type LimitesSinal } from './sinal-vida';

type Cliente = SupabaseClient<Database>;

/**
 * O trabalhador grava 'fila' a cada batimento (a cada minuto) e 'whatsapp' no mesmo batimento, só quando a Z-API
 * responde conectada. A rota /saude do trabalhador considera ruim depois de 3 min: aqui 3 min é atraso e 5 min é parado.
 */
export const LIMITES_BATIMENTO: LimitesSinal = { atrasadoApos: 180, paradoApos: 300 };

/** "Sem responsável há muito tempo" quando não dá para ler configuracoes.minutos_alerta_fila (padrão do banco). */
export const MINUTOS_SEM_RESPONSAVEL_PADRAO = 30;

/** Mês corrente no horário de Brasília: [início, início do próximo), como o trabalhador soma o gasto (custoIaDoMes). */
export function mesCorrenteSP(agora: Date): { inicio: string; fim: string } {
  const [a, m] = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' })
    .format(agora).split('-').map(Number) as [number, number];
  const mes = (ano: number, n: number) => `${ano}-${String(n).padStart(2, '0')}-01T00:00:00-03:00`;
  return { inicio: mes(a, m), fim: m === 12 ? mes(a + 1, 1) : mes(a, m + 1) };
}

export type NivelTeto = 'ok' | 'perto' | 'atingido';
export type SituacaoTeto = { gasto: number; teto: number; /** 0..∞ (1 = 100%) */ fracao: number; nivel: NivelTeto };

/** Perto a partir de 80% (quando o trabalhador manda o alerta); atingido em 100% (o agente para de responder). */
export function situacaoTeto(gasto: number, teto: number): SituacaoTeto {
  const fracao = teto > 0 ? gasto / teto : gasto > 0 ? Infinity : 0;
  const nivel: NivelTeto = teto <= 0 || gasto >= teto ? 'atingido' : fracao >= 0.8 ? 'perto' : 'ok';
  return { gasto, teto, fracao, nivel };
}

/** `parcial` fica até a Parte G redesenhar o Início: com a gastos_resumo (uma soma no banco) é sempre false. */
export type GastoDoMes = { total: number; parcial: boolean };

/** Gasto de IA do mês corrente (Brasília) pela gastos_resumo (só o administrador; os outros recebem null). */
export async function lerGastoIaDoMes(sb: Cliente, agora: Date): Promise<GastoDoMes | null> {
  const { inicio, fim } = mesCorrenteSP(agora);
  const { data, error } = await sb.rpc('gastos_resumo', { p_de: inicio, p_ate: fim });
  if (error || !data) return null;
  return { total: Number((data as { total_usd: number }).total_usd) || 0, parcial: false };
}

export type SinaisVida = { fila: string | null; whatsapp: string | null; ultimo: string | null };

/** sinais_vida por componente. null quando não dá para ler (só o administrador lê). */
export async function lerSinaisVida(sb: Cliente): Promise<SinaisVida | null> {
  const { data, error } = await sb.from('sinais_vida').select('componente, visto_em');
  if (error || !data) return null;
  const de = (c: string) => data.find((l) => l.componente === c)?.visto_em ?? null;
  const ultimo = data.reduce<string | null>((m, l) => (!m || new Date(l.visto_em) > new Date(m) ? l.visto_em : m), null);
  return { fila: de('fila'), whatsapp: de('whatsapp'), ultimo };
}

export type AlertaFaixa = { id: 'teto' | 'fila' | 'whatsapp'; nivel: 'perigo' | 'atencao'; titulo: string; texto: string };

/**
 * Faixa do topo do Início: só o que está errado agora. Fila parada (o trabalhador não bate) esconde o aviso do
 * WhatsApp, porque o sinal do WhatsApp também vem do batimento.
 */
export function alertasDaFaixa({ teto, sinais, agora }: { teto: SituacaoTeto | null; sinais: SinaisVida | null; agora: Date }): AlertaFaixa[] {
  const lista: AlertaFaixa[] = [];
  if (teto?.nivel === 'atingido') {
    lista.push({
      id: 'teto', nivel: 'perigo', titulo: 'Teto de gasto com IA atingido',
      texto: `O gasto do mês chegou a ${formatarUSD(teto.gasto)} de ${formatarUSD(teto.teto)}. O agente e o assistente não respondem: as mensagens dos clientes vão para a equipe até o mês virar ou o teto subir.`,
    });
  } else if (teto?.nivel === 'perto') {
    lista.push({
      id: 'teto', nivel: 'atencao', titulo: 'Gasto com IA perto do teto',
      texto: `${Math.floor(teto.fracao * 100)}% do teto do mês (${formatarUSD(teto.gasto)} de ${formatarUSD(teto.teto)}). Ao chegar a 100%, o agente e o assistente param de responder.`,
    });
  }
  if (sinais) {
    const fila = situacaoDoSinal(sinais.fila, agora, LIMITES_BATIMENTO);
    const whatsapp = situacaoDoSinal(sinais.whatsapp, agora, LIMITES_BATIMENTO);
    if (fila === 'parado' || fila === 'sem_sinal') {
      lista.push({
        id: 'fila', nivel: 'perigo', titulo: 'Fila de tarefas parada',
        texto: 'O trabalhador não dá sinal: mensagens novas não são processadas nem enviadas. Verifique se o trabalhador está rodando.',
      });
    } else if (whatsapp === 'parado' || whatsapp === 'sem_sinal') {
      // Não afirma "desconectado": o sinal também some se o batimento falhar antes de consultar a Z-API.
      const quando = sinais.whatsapp ? tempoRelativo(sinais.whatsapp, agora) : '';
      lista.push({
        id: 'whatsapp', nivel: 'perigo', titulo: quando ? `Sem sinal do WhatsApp ${quando}` : 'Sem sinal do WhatsApp',
        texto: 'A fila bate, mas a conexão com a Z-API não foi confirmada. Confira no painel da Z-API se o número está conectado (se não estiver, leia o QR code de novo com o celular do escritório) e, se estiver, os registros do trabalhador.',
      });
    }
  }
  return lista;
}
