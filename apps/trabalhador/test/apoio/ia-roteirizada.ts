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
export const fimVazio = (): Anthropic.Message => mensagem([], 'end_turn');
export const textoSolto = (texto: string): Anthropic.Message => mensagem([{ type: 'text', text: texto }], 'end_turn');
/** Resposta cortada no limite de tokens, com um tool_use pela metade. */
export const cortado = (): Anthropic.Message =>
  mensagem([{ type: 'text', text: 'Vou gravar' }, { type: 'tool_use', id: 'toolu_cortado', name: 'alterar_pedido_venda', input: {} }], 'max_tokens');
/** Texto e ferramenta na mesma volta. */
export const textoEFerramenta = (texto: string, nome: string, entrada: object): Anthropic.Message =>
  mensagem([{ type: 'text', text: texto }, { type: 'tool_use', id: `toolu_${Math.random().toString(36).slice(2)}`, name: nome, input: entrada }], 'tool_use');

/** Como a API de verdade: recusa (400) turno do assistente vazio, bloco de texto vazio e tool_use sem o tool_result logo depois. */
export class IaValidadora extends IaRoteirizada {
  override async criar(p: ParametrosIa): Promise<Anthropic.Message> {
    const msgs = p.messages;
    msgs.forEach((m, i) => {
      const blocos = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (m.content as { type: string; text?: string; id?: string; tool_use_id?: string }[]);
      if (blocos.length === 0) throw new Error(`400: mensagem ${i} (${m.role}) sem conteúdo`);
      if (blocos.some((b) => b.type === 'text' && !b.text?.trim())) throw new Error(`400: bloco de texto vazio na mensagem ${i}`);
      if (m.role !== 'assistant') return;
      const usos = blocos.filter((b) => b.type === 'tool_use').map((b) => b.id);
      if (usos.length === 0) return;
      const seguinte = msgs[i + 1];
      const respostas = seguinte && typeof seguinte.content !== 'string'
        ? (seguinte.content as { type: string; tool_use_id?: string }[]).filter((b) => b.type === 'tool_result').map((b) => b.tool_use_id) : [];
      if (!usos.every((id) => respostas.includes(id))) throw new Error(`400: tool_use sem tool_result depois da mensagem ${i}`);
    });
    if (msgs.at(-1)?.role !== 'user') throw new Error('400: a última mensagem tem de ser do usuário');
    return super.criar(p);
  }
}
