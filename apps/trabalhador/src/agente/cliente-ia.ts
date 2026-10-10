import Anthropic from '@anthropic-ai/sdk';

export type ParametrosIa = Anthropic.MessageCreateParamsNonStreaming;

/** Limite de uma chamada: tempo de cada tentativa e quantas tentativas extras o SDK faz. */
export type LimiteChamada = { timeoutMs: number; maxRetries: number };

export interface ClienteIa {
  /**
   * `signal`: cancela a chamada (usado pelo prazo da simulação do Treinar o agente). `limite`: tempo e tentativas desta
   * chamada (o prazo da vez, ver limiteDaChamada); sem ele, os padrões do cliente.
   */
  criar(p: ParametrosIa, opcoes?: { signal?: AbortSignal; limite?: LimiteChamada }): Promise<Anthropic.Message>;
}

/**
 * Auditoria 4.16 (M8, rodada final): 60 s cortava respostas longas do modelo. Cada tentativa vai até 150 s; com as 2
 * tentativas extras do SDK, uma chamada pode levar até 7,5 min. Na vez da conversa, limiteDaChamada encurta a chamada
 * para caber no que falta do prazo.
 */
export const TIMEOUT_IA_MS = 150_000;
export const TENTATIVAS_EXTRAS_IA = 2;

export function criarClienteIa(apiKey: string): ClienteIa {
  const cliente = new Anthropic({ apiKey, maxRetries: TENTATIVAS_EXTRAS_IA, timeout: TIMEOUT_IA_MS });
  return {
    criar: (p, opcoes) => {
      const o = {
        ...(opcoes?.signal ? { signal: opcoes.signal } : {}),
        ...(opcoes?.limite ? { timeout: opcoes.limite.timeoutMs, maxRetries: opcoes.limite.maxRetries } : {}),
      };
      return cliente.messages.create(p, Object.keys(o).length ? o : undefined);
    },
  };
}

/**
 * Auditoria 4.16 (M8): a chamada da vez nunca passa do prazo da vez (senão uma rodada lenta empurraria a vez para além
 * de PRAZO_VEZ_CONVERSA_MS e a fila repetiria o job com ela rodando). Sem prazo, ou com tempo para a chamada inteira:
 * os padrões (undefined). Prazo vencido: null, a rodada não começa. No meio: cada tentativa até o que falta, e só as tentativas
 * extras que cabem nele.
 */
export function limiteDaChamada(prazo: number | undefined, agora: number = Date.now()): LimiteChamada | null | undefined {
  if (prazo === undefined) return undefined;
  const restante = prazo - agora;
  if (restante <= 0) return null;
  if (restante >= TIMEOUT_IA_MS * (TENTATIVAS_EXTRAS_IA + 1)) return undefined;
  const timeoutMs = Math.min(TIMEOUT_IA_MS, restante);
  return { timeoutMs, maxRetries: Math.max(0, Math.min(TENTATIVAS_EXTRAS_IA, Math.floor(restante / timeoutMs) - 1)) };
}

/** Auditoria 4.8: o erro veio da chamada à IA (resposta da API ou rede), e não de uma ferramenta ou do banco. */
export function erroDaIa(e: unknown): boolean {
  return e instanceof Anthropic.APIError;
}

/** O `type` do corpo do erro da API ({ type: 'error', error: { type } }). */
function tipoDoErro(e: InstanceType<typeof Anthropic.APIError>): string | undefined {
  const corpo = e.error as { type?: unknown; error?: { type?: unknown } } | undefined;
  const t = corpo?.error?.type ?? corpo?.type;
  return typeof t === 'string' ? t : undefined;
}

/**
 * Auditoria 4.8: erro que vale para todas as conversas (chave recusada, conta sem permissão, cobrança ou limite de gasto da
 * conta), e não só para esta. Devolve o motivo curto para o alerta ao dono, ou null.
 * Revisão: a cobrança pode vir como 402 ou `billing_error`, e o limite de uso em outro status (não só 400).
 */
export function falhaGeralIa(e: unknown): string | null {
  if (!(e instanceof Anthropic.APIError)) return null;
  if (e.status === 401) return 'chave da API recusada';
  if (e.status === 403) return 'sem permissão na conta da API';
  if (e.status === 402 || tipoDoErro(e) === 'billing_error' || /credit balance|usage limits?|spend(ing)? limit/i.test(e.message)) {
    return 'limite de gasto da conta atingido';
  }
  return null;
}

/**
 * Auditoria 4.8 (revisão): só a falha que não depende da conversa (rede, 429, 5xx) entra na sequência de "3 conversas
 * seguidas". Um 400 próprio da conversa (imagem ruim, prompt longo) não; chave e cobrança já avisam sozinhas.
 */
export function falhaQueContaNaSequencia(e: unknown): boolean {
  return erroTemporarioIa(e) && falhaGeralIa(e) === null;
}

/** Erros em que vale tentar de novo mais tarde (rede, limite de taxa, instabilidade). */
export function erroTemporarioIa(e: unknown): boolean {
  if (e instanceof Anthropic.APIConnectionError || e instanceof Anthropic.RateLimitError) return true;
  if (e instanceof Anthropic.APIError) return (e.status ?? 0) >= 500;
  return false;
}
