import type Anthropic from '@anthropic-ai/sdk';
import type { ClienteIa, ParametrosIa } from '../../src/agente/cliente-ia';

function mensagem(content: unknown[], stop_reason: string): Anthropic.Message {
  return {
    id: `msg_${Math.random().toString(36).slice(2)}`, type: 'message', role: 'assistant', model: 'claude-sonnet-5',
    content, stop_reason, stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as unknown as Anthropic.Message;
}

export function usarFerramentas(...chamadas: { nome: string; entrada: object }[]): Anthropic.Message {
  return mensagem(chamadas.map((c, i) => ({ type: 'tool_use', id: `toolu_${i}_${Math.random().toString(36).slice(2)}`, name: c.nome, input: c.entrada })), 'tool_use');
}
export const fim = (): Anthropic.Message => mensagem([{ type: 'text', text: 'ok' }], 'end_turn');
export const recusa = (): Anthropic.Message => mensagem([], 'refusal');

/** Devolve respostas prontas em ordem e guarda cada requisição recebida. */
export class IaRoteirizada implements ClienteIa {
  recebidos: ParametrosIa[] = [];
  constructor(private readonly roteiro: (Anthropic.Message | Error)[]) {}
  async criar(p: ParametrosIa): Promise<Anthropic.Message> {
    this.recebidos.push(structuredClone(p));
    const r = this.roteiro.shift();
    if (!r) throw new Error('roteiro da IA acabou');
    if (r instanceof Error) throw r;
    return r;
  }
  /** Resultados de ferramenta enviados de volta na última requisição. */
  ultimosResultados(): { content: string; is_error?: boolean }[] {
    const ultima = this.recebidos.at(-1)!.messages.at(-1)!;
    return (ultima.content as { type: string; content: string; is_error?: boolean }[]).filter((b) => b.type === 'tool_result');
  }
}
