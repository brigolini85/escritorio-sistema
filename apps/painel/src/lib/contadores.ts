// Leituras do menu e da barra do topo (D1). Sempre com o cliente do usuário: o RLS decide o que entra na conta.
// Falha de leitura nunca quebra a casca: volta null e o contador simplesmente não aparece.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@escritorio/db';

type Cliente = SupabaseClient<Database>;

/**
 * Conversas aguardando atendimento humano: as que têm demanda aberta sem responsável
 * (coluna sem_responsavel da caixa_entrada, o mesmo filtro "Sem responsável" do Atendimento).
 * É assim que o agente encaminha para a equipe: abre uma demanda sem responsável; "Assumir" preenche o responsável.
 */
export async function contarConversasAguardando(sb: Cliente): Promise<number | null> {
  const { count, error } = await sb.from('caixa_entrada').select('id', { count: 'exact', head: true }).eq('sem_responsavel', true);
  return error ? null : count ?? 0;
}

/** Demandas não concluídas que a pessoa enxerga (RLS: do setor dela ou dela; o administrador vê todas). */
export async function contarDemandasAbertas(sb: Cliente): Promise<number | null> {
  const { count, error } = await sb.from('chamados').select('id', { count: 'exact', head: true }).neq('status', 'concluido');
  return error ? null : count ?? 0;
}

/** Estado geral do agente (configuracoes.agente_pausado). null quando o RLS não deixa ler (só administrador lê). */
export async function lerAgentePausado(sb: Cliente): Promise<boolean | null> {
  const { data, error } = await sb.from('configuracoes').select('agente_pausado').eq('id', 1).maybeSingle();
  if (error || !data) return null;
  return data.agente_pausado;
}

/** Texto do selo do menu: nada para zero ou desconhecido, "99+" acima de 99. */
export function rotuloContador(n: number | null | undefined): string | null {
  if (!n || n <= 0) return null;
  return n > 99 ? '99+' : String(n);
}

/** Frase para leitor de tela ao lado do item do menu. */
export function descricaoContador(tipo: 'atendimento' | 'demandas', n: number): string {
  if (tipo === 'atendimento') return n === 1 ? '1 conversa aguardando atendimento' : `${n} conversas aguardando atendimento`;
  return n === 1 ? '1 demanda aberta' : `${n} demandas abertas`;
}

/** Janela depois de uma ação da própria pessoa (enviar formulário, navegar) em que um aumento não vira aviso. */
export const JANELA_ACAO_PROPRIA_MS = 3000;

/** Avisar "Nova conversa aguardando atendimento"? Só se o número subiu e a pessoa não acabou de agir. */
export function deveAvisarNovaConversa(antes: number | null, depois: number | null, msDesdeUltimaAcao: number): boolean {
  if (antes === null || depois === null || depois <= antes) return false;
  return msDesdeUltimaAcao > JANELA_ACAO_PROPRIA_MS;
}
