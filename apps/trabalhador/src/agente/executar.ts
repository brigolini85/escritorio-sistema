import type Anthropic from '@anthropic-ai/sdk';
import { calcularCustoUsd } from '@escritorio/core';
import type { ContextoAgente } from './contexto';
import { FERRAMENTAS, executarFerramenta, type DepsAgente, type EstadoExecucao } from './ferramentas';
import { montarSistema } from './prompt';

export const MAX_ITERACOES = 6;
/** `respondeu`: se o agente mandou alguma mensagem ao cliente neste turno (antes de escalar). */
export type ResultadoAgente = { status: 'ok' } | { status: 'escalar'; motivo: string; respondeu: boolean };

async function registrarUso(d: DepsAgente, ctx: ContextoAgente, r: Anthropic.Message): Promise<void> {
  const preco = ctx.config.precosModelos[ctx.config.modeloConversa] ?? { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  const uso = {
    entrada: r.usage.input_tokens,
    saida: r.usage.output_tokens,
    cacheLeitura: r.usage.cache_read_input_tokens ?? 0,
    cacheEscrita: r.usage.cache_creation_input_tokens ?? 0,
  };
  await d.repos.registrarUsoIa({
    conversaId: ctx.conversa.id, modelo: ctx.config.modeloConversa, tokensEntrada: uso.entrada, tokensSaida: uso.saida,
    tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita, custoUsd: calcularCustoUsd(uso, preco),
  });
}

export async function executarAgente(d: DepsAgente, ctx: ContextoAgente, conteudo: Anthropic.ContentBlockParam[]): Promise<ResultadoAgente> {
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: montarSistema(ctx.setores, ctx.respostasProntas), cache_control: { type: 'ephemeral' } }];
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: conteudo }];
  const estado: EstadoExecucao = { ctx, respondeu: false };

  for (let i = 0; i < MAX_ITERACOES; i++) {
    const r = await d.ia.criar({
      model: ctx.config.modeloConversa,
      max_tokens: 16000,
      system,
      tools: FERRAMENTAS,
      messages,
      output_config: { effort: 'medium' },
    });
    await registrarUso(d, ctx, r);

    if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') return { status: 'escalar', motivo: r.stop_reason, respondeu: estado.respondeu };
    const usos = r.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || usos.length === 0) {
      return estado.respondeu ? { status: 'ok' } : { status: 'escalar', motivo: 'terminou sem responder', respondeu: false };
    }

    messages.push({ role: 'assistant', content: r.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    // Em ordem: selecionar_empresa precisa valer antes de abrir_chamado na mesma rodada.
    for (const u of usos) {
      const res = await executarFerramenta(d, estado, u.name, u.input);
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.resultado, is_error: res.erro });
    }
    messages.push({ role: 'user', content: resultados });
  }
  return estado.respondeu ? { status: 'ok' } : { status: 'escalar', motivo: 'limite de iterações', respondeu: false };
}
