import Anthropic from '@anthropic-ai/sdk';

export type ParametrosIa = Anthropic.MessageCreateParamsNonStreaming;

export interface ClienteIa {
  criar(p: ParametrosIa): Promise<Anthropic.Message>;
}

export function criarClienteIa(apiKey: string): ClienteIa {
  const cliente = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
  return { criar: (p) => cliente.messages.create(p) };
}

/** Erros em que vale tentar de novo mais tarde (rede, limite de taxa, instabilidade). */
export function erroTemporarioIa(e: unknown): boolean {
  if (e instanceof Anthropic.APIConnectionError || e instanceof Anthropic.RateLimitError) return true;
  if (e instanceof Anthropic.APIError) return (e.status ?? 0) >= 500;
  return false;
}
