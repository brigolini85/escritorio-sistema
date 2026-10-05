import 'server-only';
import { ehPreAnaliseNota, type PreAnaliseNota } from '@escritorio/core';
import { semMigracaoI1 } from '@/lib/agentes';
import type { supabaseServidor } from '@/lib/supabase/servidor';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
export type SugestaoTela = {
  id: string; tipo: 'nota_interna' | 'correcao'; agente: string; texto: string; estado: 'aguardando' | 'aprovada' | 'descartada';
  criadaEm: string; decididaPor: string | null;
};
/** O trabalho do agente do setor dentro da demanda (D9, D19). `semI2`: o banco ainda não tem a Parte I2 (o bloco some). */
export type TrabalhoDoAgente = { preAnalise: PreAnaliseNota | null; agente: string | null; sugestoes: SugestaoTela[]; semI2: boolean };
const VAZIO: TrabalhoDoAgente = { preAnalise: null, agente: null, sugestoes: [], semI2: false };

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
/** A frase que a pessoa lê antes de aprovar (a nota que entra na linha do tempo é montada pelo banco). */
export function textoDaSugestao(tipo: SugestaoTela['tipo'], conteudo: unknown): string {
  const c = (conteudo ?? {}) as Record<string, unknown>;
  if (tipo === 'nota_interna') return texto(c.texto);
  return `Corrigir ${texto(c.campo)}: ${texto(c.de) || '—'} → ${texto(c.para)}. Motivo: ${texto(c.motivo)}`;
}

/**
 * Lido com a sessão da pessoa (RLS: vê a demanda). Sem "Pedidos de nota" (ruling F5; o banco também exige) não há
 * pré-análise nem sugestões: nem pergunta ao banco. O banco sem a I2 vem dos códigos reais do GET (nunca head).
 */
export async function lerTrabalhoDoAgente(sb: Sb, chamadoId: string, verPedidos: boolean): Promise<TrabalhoDoAgente> {
  // Sugestões sempre lidas: a RLS (F5) esconde as de demanda com pedido de nota para quem não vê "Pedidos de nota".
  const [pa, sg] = await Promise.all([
    verPedidos
      ? sb.from('pre_analises_nota').select('resultado, agentes(nome)').eq('chamado_id', chamadoId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    sb.from('agente_sugestoes').select('id, tipo, conteudo, estado, criado_em, agentes(nome), decisor:usuarios!agente_sugestoes_decidida_por_fkey(nome)')
      .eq('chamado_id', chamadoId).order('criado_em'),
  ]);
  if (semMigracaoI1(pa.error) || semMigracaoI1(sg.error)) return { ...VAZIO, semI2: true };
  if (pa.error) console.error('[demandas] pré-análise', pa.error);
  if (sg.error) console.error('[demandas] sugestões do agente', sg.error);
  const pre = pa.data as { resultado: unknown; agentes: { nome: string } | null } | null;
  const linhas = (sg.data ?? []) as unknown as {
    id: string; tipo: SugestaoTela['tipo']; conteudo: unknown; estado: SugestaoTela['estado']; criado_em: string;
    agentes: { nome: string } | null; decisor: { nome: string } | null;
  }[];
  const sugestoes = linhas.map((s) => ({
    id: s.id, tipo: s.tipo, agente: s.agentes?.nome ?? 'Agente do setor', texto: textoDaSugestao(s.tipo, s.conteudo), estado: s.estado,
    criadaEm: s.criado_em, decididaPor: s.decisor?.nome ?? null,
  }));
  const preAnalise = pre && ehPreAnaliseNota(pre.resultado) ? pre.resultado : null;
  return { preAnalise, agente: (preAnalise ? pre?.agentes?.nome : null) ?? sugestoes[0]?.agente ?? null, sugestoes, semI2: false };
}
