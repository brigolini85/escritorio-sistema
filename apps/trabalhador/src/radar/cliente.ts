import Anthropic from '@anthropic-ai/sdk';
import type { ClienteIa } from '../agente/cliente-ia';

/** D8: um turno com busca e leitura na web passa fácil de 60 s (o tempo do cliente da conversa); o giro espera até 5 min por chamada. */
export function criarClienteIaRadar(apiKey: string): ClienteIa {
  const cliente = new Anthropic({ apiKey, maxRetries: 1, timeout: 300_000 });
  return { criar: (p, opcoes) => cliente.messages.create(p, opcoes?.signal ? { signal: opcoes.signal } : undefined) };
}
