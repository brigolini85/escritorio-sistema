import type Anthropic from '@anthropic-ai/sdk';
import { calcularCustoUsd } from '@escritorio/core';
import type { MensagemAssistente } from '@escritorio/db';
import type { ContextoAssistente } from './contexto';
import { FERRAMENTAS_ASSISTENTE, executarFerramentaAssistente, type DepsAssistente, type EstadoAssistente } from './ferramentas';
import { mensagensDoHistorico, montarSistemaAssistente } from './prompt';

const MAX_VOLTAS = 8;
const LEMBRETE = 'Texto fora das ferramentas não chega à pessoa. Use a ferramenta responder.';

export async function executarAssistente(d: DepsAssistente, ctx: ContextoAssistente, historico: MensagemAssistente[]): Promise<EstadoAssistente> {
  const estado: EstadoAssistente = { ctx, resposta: [], arquivo: null, csvs: [], previas: new Set() };
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: montarSistemaAssistente(ctx) }];
  const messages = mensagensDoHistorico(historico);
  const preco = ctx.config.precosModelos[ctx.config.modeloConversa] ?? { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  let lembrado = false;
  for (let i = 0; i < MAX_VOLTAS; i++) {
    const r = await d.ia.criar({ model: ctx.config.modeloConversa, max_tokens: 16000, system, tools: FERRAMENTAS_ASSISTENTE, messages, output_config: { effort: 'medium' } });
    const uso = { entrada: r.usage.input_tokens, saida: r.usage.output_tokens, cacheLeitura: r.usage.cache_read_input_tokens ?? 0, cacheEscrita: r.usage.cache_creation_input_tokens ?? 0 };
    await d.repos.registrarUsoIa({ conversaId: null, modelo: ctx.config.modeloConversa, tokensEntrada: uso.entrada, tokensSaida: uso.saida,
      tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita, custoUsd: calcularCustoUsd(uso, preco) });
    const usos = r.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || usos.length === 0) {
      if (estado.resposta.length || lembrado || r.stop_reason === 'refusal') return estado;
      lembrado = true;
      messages.push({ role: 'assistant', content: r.content }, { role: 'user', content: [{ type: 'text', text: LEMBRETE }] });
      continue;
    }
    messages.push({ role: 'assistant', content: r.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const u of usos) {
      const res = await executarFerramentaAssistente(d, estado, u.name, u.input);
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.resultado, is_error: res.erro });
    }
    messages.push({ role: 'user', content: resultados });
  }
  return estado;
}
