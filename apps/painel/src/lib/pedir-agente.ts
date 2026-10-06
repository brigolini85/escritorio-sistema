import 'server-only';
import { semMigracaoI1 } from './agentes';
import type { AgenteParaPedirTela, DadosPedir } from './pedir-agente-tela';
import type { supabaseServidor } from './supabase/servidor';
import { lerAgentesDeTrabalho } from './tarefas';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
type Linha = { id: string; nome: string; descricao: string | null; setor: string; estado: 'teste' | 'ligado'; destino: 'esta_demanda' | 'nova'; procedimentos: unknown;
  custo_n: number | null; custo_min: number | null; custo_max: number | null; limite_usd: number };

/** I4: os agentes que a pessoa pode pedir (D5, D15), o destino (D6), o custo (D13) e se o WhatsApp dela recebe avisos (D9). Sem a I4, a lista da I3a (D17). */
export async function lerDadosPedir(sb: Sb, chamadoId: string | null): Promise<DadosPedir> {
  const [r, w] = await Promise.all([sb.rpc('agentes_para_pedir', { p_chamado: chamadoId as string }), sb.rpc('meu_whatsapp_para_avisos')]);
  if (semMigracaoI1(r.error)) {
    const antigos = chamadoId ? await lerAgentesDeTrabalho(sb, chamadoId) : null;
    return { i4: false, whatsapp: null, donoVeTodos: false, agentes: (antigos ?? []).filter((a) => a.podePedir).map((a): AgenteParaPedirTela => ({
      id: a.id, nome: a.nome, descricao: '', setor: '', estado: a.estado, destino: 'esta_demanda', procedimentos: a.procedimentos, custo: null })) };
  }
  if (r.error) console.error('[pedir] agentes para pedir', r.error);
  const agentes = ((r.data ?? []) as unknown as Linha[]).map((a): AgenteParaPedirTela => ({
    id: a.id, nome: a.nome, descricao: a.descricao ?? '', setor: a.setor, estado: a.estado, destino: a.destino,
    procedimentos: Array.isArray(a.procedimentos) ? (a.procedimentos as AgenteParaPedirTela['procedimentos']) : [],
    custo: { n: Number(a.custo_n ?? 0), min: a.custo_min === null ? null : Number(a.custo_min), max: a.custo_max === null ? null : Number(a.custo_max), limite: Number(a.limite_usd) },
  }));
  return { i4: true, agentes, whatsapp: w.error ? 'Não consegui conferir seu WhatsApp agora.' : ((w.data as string | null) ?? null),
    donoVeTodos: new Set(agentes.map((a) => a.setor)).size > 1 };
}
