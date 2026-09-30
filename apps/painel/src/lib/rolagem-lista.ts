/**
 * O que uma lista de mensagens rolante (histórico do Atendimento, conversa do Assistente) faz quando a página é redesenhada:
 * - 'inicio': primeira exibição, vai para a mensagem mais nova;
 * - 'manter-fim': nada novo, mas a pessoa estava no fim (o conteúdo pode ter crescido): continua no fim;
 * - 'nada': nada novo e a pessoa está lendo acima;
 * - 'descer': chegou algo novo e a pessoa estava no fim (ou acabou de enviar);
 * - 'avisar': chegou algo novo e a pessoa está lendo acima: mostra "Novas mensagens ↓" sem mexer na rolagem.
 */
export type AcaoRolagem = 'inicio' | 'manter-fim' | 'nada' | 'descer' | 'avisar';

/** Depois de enviar pelo compositor, o que chegar nesse intervalo desce a rolagem (a pessoa quer ver o que mandou / a resposta). */
export const JANELA_ENVIO_MS = 15_000;

/** Distância do fim (px) em que a pessoa ainda conta como "no fim da lista". */
export const PERTO_DO_FIM = 48;

/**
 * `ultima` identifica o fim da lista (ex.: id da última mensagem); mudou = chegou algo novo.
 * Identidade, não contagem: uma mensagem apagada e outra nova no mesmo redesenho ainda conta como novidade.
 */
export function decidirRolagem(p: { anterior: string | null; ultima: string; noFim: boolean; desdeEnvioMs: number }): AcaoRolagem {
  if (p.anterior === null) return 'inicio';
  if (p.anterior === p.ultima) return p.noFim ? 'manter-fim' : 'nada';
  return p.noFim || p.desdeEnvioMs < JANELA_ENVIO_MS ? 'descer' : 'avisar';
}

/** A rolagem está a menos de `PERTO_DO_FIM` px do fim. */
export function estaNoFim(el: { scrollHeight: number; clientHeight: number; scrollTop: number }): boolean {
  return el.scrollHeight - el.clientHeight - el.scrollTop < PERTO_DO_FIM;
}
