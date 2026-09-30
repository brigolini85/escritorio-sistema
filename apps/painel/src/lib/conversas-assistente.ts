/**
 * Histórico da tela Assistente (coluna da esquerda): a conversa "Geral" (contexto do site, sem conversa) e as
 * conversas com o assistente feitas dentro de um atendimento. Lê as mensagens mais novas da pessoa e agrupa por
 * atendimento, da conversa mais recente para a mais antiga.
 */

export type MensagemDoHistorico = { conversa_id: string | null; criado_em: string };
export type ConversaDoAssistente = { conversaId: string; ultimaEm: string; mensagens: number };

/** Quantas mensagens ler para montar a lista (as mais novas). */
export const LIMITE_MENSAGENS_HISTORICO = 400;
/** Quantas conversas mostrar na coluna. */
export const LIMITE_CONVERSAS_HISTORICO = 30;

/**
 * Espera as mensagens da mais nova para a mais antiga; ignora as sem conversa (são da "Geral").
 * `mensagens` conta só as mensagens lidas (as LIMITE_MENSAGENS_HISTORICO mais novas).
 */
export function agruparConversasAssistente(linhas: MensagemDoHistorico[], limite = LIMITE_CONVERSAS_HISTORICO): ConversaDoAssistente[] {
  const grupos = new Map<string, ConversaDoAssistente>();
  for (const m of linhas) {
    if (!m.conversa_id) continue;
    const g = grupos.get(m.conversa_id);
    if (g) {
      g.mensagens++;
      continue;
    }
    if (grupos.size >= limite) continue;
    grupos.set(m.conversa_id, { conversaId: m.conversa_id, ultimaEm: m.criado_em, mensagens: 1 });
  }
  return [...grupos.values()];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ?conversa= da tela Assistente: só um id válido; qualquer outra coisa volta para a "Geral". */
export function lerConversaAssistente(valor: string | string[] | undefined): string | null {
  const v = Array.isArray(valor) ? valor[0] : valor;
  return v && UUID.test(v) ? v.toLowerCase() : null;
}
