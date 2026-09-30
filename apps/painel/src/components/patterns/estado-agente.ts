/**
 * Estado do agente de clientes (o robô do WhatsApp), sem React: textos e regras usados pelo AgentStateIndicator,
 * pelo layout (servidor) e pela casca ao vivo (navegador). Fonte única dos textos de motivo.
 */

/** Por que o agente não está respondendo. */
export type MotivoPausa = 'geral' | 'contato' | 'empresa' | 'teto_ia';

export type EstadoAgente =
  | { tipo: 'ativo' }
  /** `detalhe`: complemento opcional, ex.: nome do contato ou da empresa pausada. */
  | { tipo: 'pausado'; motivo?: MotivoPausa; detalhe?: string }
  | { tipo: 'assumido'; por: string };

export const MOTIVOS_PAUSA: Record<MotivoPausa, string> = {
  geral: 'Pausa geral',
  contato: 'Pausado para este contato',
  empresa: 'Pausado para esta empresa',
  teto_ia: 'Teto de gasto com IA atingido',
};

/** configuracoes.agente_pausado → estado do topo; null quando a pessoa não pode ler (RLS). */
export function estadoPelaPausaGeral(pausado: boolean | null): EstadoAgente | null {
  if (pausado === null) return null;
  return pausado ? { tipo: 'pausado', motivo: 'geral' } : { tipo: 'ativo' };
}

export function tituloEstadoAgente(e: EstadoAgente): string {
  if (e.tipo === 'ativo') return 'Agente ativo';
  if (e.tipo === 'pausado') return 'Agente pausado';
  return `Assumida por ${e.por}`;
}

/** Segunda linha (variante completa) e complemento do tooltip/leitor de tela. */
export function detalheEstadoAgente(e: EstadoAgente): string | null {
  if (e.tipo === 'ativo') return 'Respondendo aos clientes';
  if (e.tipo === 'assumido') return 'O agente não responde nesta conversa';
  if (!e.motivo) return e.detalhe ?? null;
  return e.detalhe ? `${MOTIVOS_PAUSA[e.motivo]}: ${e.detalhe}` : MOTIVOS_PAUSA[e.motivo];
}
