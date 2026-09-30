/**
 * Estado do agente de clientes (o robô do WhatsApp), sem React: textos e regras usados pelo AgentStateIndicator,
 * pelo layout (servidor) e pela casca ao vivo (navegador). Fonte única dos textos de motivo.
 */

/** Por que o agente não está respondendo. */
export type MotivoPausa = 'geral' | 'contato' | 'empresa' | 'teto_ia';

export type EstadoAgente =
  | { tipo: 'ativo' }
  /** Com o agente, mas sem como saber se há pausa geral (só o administrador lê configuracoes): não afirma 'ativo'. */
  | { tipo: 'com_agente' }
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
  if (e.tipo === 'com_agente') return 'Com o agente';
  if (e.tipo === 'pausado') return 'Agente pausado';
  return `Assumida por ${e.por}`;
}

/** Segunda linha (variante completa) e complemento do tooltip/leitor de tela. */
export function detalheEstadoAgente(e: EstadoAgente): string | null {
  if (e.tipo === 'ativo') return 'Respondendo aos clientes';
  if (e.tipo === 'com_agente') return 'Ninguém assumiu esta conversa. A pausa geral do agente só o administrador vê.';
  if (e.tipo === 'assumido') return 'O agente não responde nesta conversa';
  if (!e.motivo) return e.detalhe ?? null;
  return e.detalhe ? `${MOTIVOS_PAUSA[e.motivo]}: ${e.detalhe}` : MOTIVOS_PAUSA[e.motivo];
}

/**
 * Estado do agente numa conversa, do mais forte para o mais fraco: assumida por alguém > pausa geral >
 * pausado para a empresa > pausado para o contato > ativo. `pausaGeral` null = não dá para saber
 * (só o administrador lê configuracoes): nesse caso nunca afirma "ativo"; vira o estado neutro "Com o agente".
 */
export function estadoDaConversa(c: {
  assumidaPor: string | null;
  pausaGeral: boolean | null;
  empresaPausada?: boolean | null;
  contatoPausado?: boolean | null;
}): EstadoAgente {
  if (c.assumidaPor) return { tipo: 'assumido', por: c.assumidaPor };
  if (c.pausaGeral) return { tipo: 'pausado', motivo: 'geral' };
  if (c.empresaPausada) return { tipo: 'pausado', motivo: 'empresa' };
  if (c.contatoPausado) return { tipo: 'pausado', motivo: 'contato' };
  return c.pausaGeral === null ? { tipo: 'com_agente' } : { tipo: 'ativo' };
}

/**
 * Estado geral do agente (Início): pausa geral > teto de gasto com IA atingido > ativo.
 * null quando não dá para ler a pausa geral (só o administrador lê configuracoes).
 */
export function estadoGeralDoAgente(pausado: boolean | null, tetoAtingido: boolean | null): EstadoAgente | null {
  if (pausado === null) return null;
  if (pausado) return { tipo: 'pausado', motivo: 'geral' };
  if (tetoAtingido) return { tipo: 'pausado', motivo: 'teto_ia' };
  return { tipo: 'ativo' };
}
