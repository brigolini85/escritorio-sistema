import Anthropic from '@anthropic-ai/sdk';

export type ParametrosIa = Anthropic.MessageCreateParamsNonStreaming;

export interface ClienteIa {
  /** `signal`: cancela a chamada (usado pelo prazo da simulação do Treinar o agente). */
  criar(p: ParametrosIa, opcoes?: { signal?: AbortSignal }): Promise<Anthropic.Message>;
}

export function criarClienteIa(apiKey: string): ClienteIa {
  const cliente = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
  return { criar: (p, opcoes) => cliente.messages.create(p, opcoes?.signal ? { signal: opcoes.signal } : undefined) };
}

/** Auditoria 4.8: o erro veio da chamada à IA (resposta da API ou rede), e não de uma ferramenta ou do banco. */
export function erroDaIa(e: unknown): boolean {
  return e instanceof Anthropic.APIError;
}

/**
 * Auditoria 4.8: erro que vale para todas as conversas (chave recusada, conta sem permissão, limite de gasto da conta), e
 * não só para esta. Devolve o motivo curto para o alerta ao dono, ou null.
 */
export function falhaGeralIa(e: unknown): string | null {
  if (!(e instanceof Anthropic.APIError)) return null;
  if (e.status === 401) return 'chave da API recusada';
  if (e.status === 403) return 'sem permissão na conta da API';
  if (e.status === 400 && /credit balance|usage limits?|spend(ing)? limit/i.test(e.message)) return 'limite de gasto da conta atingido';
  return null;
}

/** Erros em que vale tentar de novo mais tarde (rede, limite de taxa, instabilidade). */
export function erroTemporarioIa(e: unknown): boolean {
  if (e instanceof Anthropic.APIConnectionError || e instanceof Anthropic.RateLimitError) return true;
  if (e instanceof Anthropic.APIError) return (e.status ?? 0) >= 500;
  return false;
}
