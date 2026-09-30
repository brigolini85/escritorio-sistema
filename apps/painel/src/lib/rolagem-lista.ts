/**
 * O que a lista de mensagens (assistente) faz quando a página é redesenhada:
 * - 'inicio': primeira exibição, vai para a mensagem mais nova;
 * - 'manter-fim': nada novo, mas a pessoa estava no fim (o conteúdo pode ter crescido): continua no fim;
 * - 'nada': nada novo e a pessoa está lendo acima;
 * - 'descer': chegou algo novo e a pessoa estava no fim (ou acabou de perguntar);
 * - 'avisar': chegou algo novo e a pessoa está lendo acima: mostra "Novas mensagens ↓" sem mexer na rolagem.
 */
export type AcaoRolagem = 'inicio' | 'manter-fim' | 'nada' | 'descer' | 'avisar';

/** Depois de enviar uma pergunta, o que chegar nesse intervalo desce a rolagem (a pessoa quer ver a resposta). */
export const JANELA_ENVIO_MS = 15_000;

export function decidirRolagem(p: { anterior: string | null; ultima: string; noFim: boolean; desdeEnvioMs: number }): AcaoRolagem {
  if (p.anterior === null) return 'inicio';
  if (p.anterior === p.ultima) return p.noFim ? 'manter-fim' : 'nada';
  return p.noFim || p.desdeEnvioMs < JANELA_ENVIO_MS ? 'descer' : 'avisar';
}
