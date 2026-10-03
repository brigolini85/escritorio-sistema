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
} as const;

const ESCALADAS: Record<string, string> = {
  refusal: 'o modelo se recusou a responder',
  max_tokens: 'a resposta ficou longa demais',
  'terminou sem responder': 'o agente terminou sem responder',
  'limite de iterações': 'o agente passou do número máximo de passos',
};

/** Motivo de executarAgente (status "escalar") em texto da tela; desconhecido vira um texto genérico. */
export function motivoDaEscalada(motivo: string): string {
  return ESCALADAS[motivo] ?? 'o agente não conseguiu concluir';
}

/** "pediu para falar com pessoa" tem linha de estado própria na lista do Atendimento. */
export const ehPedidoDoCliente = (motivo: string | null | undefined): boolean => motivo === MOTIVOS_PASSAGEM.pedidoCliente;
