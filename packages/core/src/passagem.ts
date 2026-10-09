// Motivos da passagem para uma pessoa (spec 7A.2): textos fixos do sistema, gravados pelo trabalhador em
// conversas.motivo_pessoa e lidos pelo painel. Nunca texto do modelo nem do cliente (decisão 2 do plano da Parte E).

export const MOTIVOS_PASSAGEM = {
  pedidoCliente: 'pediu para falar com pessoa',
  naoEntendeu: 'não entendeu o pedido duas vezes',
  teto: 'limite mensal de gasto com IA atingido',
  pausaGeral: 'agente pausado',
  pausaContato: 'agente desligado para este contato',
  pausaEmpresa: 'agente pausado para esta empresa',
  falha: 'falha no agente de IA',
  // Revisão geral C1 e I4: mensagem que ficou sem resposta do agente; muitas mensagens seguidas (resposta automática).
  semResposta: 'mensagem do cliente ficou sem resposta do agente',
  volume: 'muitas mensagens seguidas (possível resposta automática)',
  // Auditoria 4.2 e 5.2 (D2): o número passou do limite diário de gasto com IA.
  limiteDia: 'limite diário de gasto com IA deste número atingido',
  // Auditoria 4.1: a vez caiu (implantação, reinício) depois de o agente agir; a retomada não chama a IA de novo.
  interrompido: 'atendimento interrompido (reinício)',
} as const;

const ESCALADAS: Record<string, string> = {
  refusal: 'o modelo se recusou a responder',
  max_tokens: 'a resposta ficou longa demais',
  'terminou sem responder': 'o agente terminou sem responder',
  'limite de iterações': 'o agente passou do número máximo de passos',
  'tempo esgotado': 'o agente passou do tempo máximo da vez',
  // Auditoria 4.11: limite do número ou teto do mês atingido entre as rodadas.
  'limite de custo': 'o agente passou do limite de gasto com IA',
  // Auditoria 5.6: o modelo insistiu em ação além do limite por atendimento (demandas, respostas, documentos).
  'limite de ações': 'o agente insistiu em passar do limite de ações do atendimento',
};

/** Motivo de executarAgente (status "escalar") em texto da tela; desconhecido vira um texto genérico. */
export function motivoDaEscalada(motivo: string): string {
  return ESCALADAS[motivo] ?? 'o agente não conseguiu concluir';
}

/** "pediu para falar com pessoa" tem linha de estado própria na lista do Atendimento. */
export const ehPedidoDoCliente = (motivo: string | null | undefined): boolean => motivo === MOTIVOS_PASSAGEM.pedidoCliente;
