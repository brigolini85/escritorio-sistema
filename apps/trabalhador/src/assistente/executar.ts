import type Anthropic from '@anthropic-ai/sdk';
import { calcularCustoUsd, usoDaResposta } from '@escritorio/core';
import type { MensagemAssistente } from '@escritorio/db';
import type { ExtraAssistente } from './agentes';
import type { ContextoAssistente } from './contexto';
import { FERRAMENTAS_ASSISTENTE, executarFerramentaAssistente, novoEstado, type DepsAssistente, type EstadoAssistente } from './ferramentas';
import { mensagensDoHistorico, montarSistemaAssistente } from './prompt';

const MAX_VOLTAS = 8;
const LEMBRETE = 'Texto fora das ferramentas não chega à pessoa. Use a ferramenta responder.';
export const MENSAGEM_VAZIA = 'Não consegui concluir. Pode pedir de outro jeito?';

export async function executarAssistente(d: DepsAssistente, ctx: ContextoAssistente, historico: MensagemAssistente[], extra?: ExtraAssistente): Promise<EstadoAssistente> {
  const estado = novoEstado(ctx);
  const system: Anthropic.TextBlockParam[] = [{ type: 'text', text: montarSistemaAssistente(ctx), cache_control: { type: 'ephemeral' } }];
  // I4 (D3): a seção do pedido vem num segundo bloco, sem cache; o primeiro e as ferramentas de hoje não mudam.
  if (extra) system.push({ type: 'text', text: extra.sistema });
  const tools = extra ? [...FERRAMENTAS_ASSISTENTE, ...extra.ferramentas] : FERRAMENTAS_ASSISTENTE;
  const messages = mensagensDoHistorico(historico);
  const preco = ctx.config.precosModelos[ctx.config.modeloConversa] ?? { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  let lembrado = false;
  /** Texto solto do modelo na última volta, desde que nenhuma ferramenta tenha rodado depois dele. */
  let ultimoTexto = '';
  /** Motivo da última gravação recusada nesta execução (alterar_pedido_venda com confirmado = true). */
  let falhaGravacao: string | null = null;

  /** Sem texto do responder: primeiro os fatos (o que foi gravado ou falhou), depois o texto final do modelo. */
  const fechar = () => {
    if (estado.resposta.length === 0) {
      if (estado.acoes.length) estado.resposta.push(`Feito: ${estado.acoes.join('; ')}.${ultimoTexto ? `\n\n${ultimoTexto}` : ''}`);
      else if (falhaGravacao) estado.resposta.push(`Não consegui gravar: ${falhaGravacao}`);
      else estado.resposta.push(ultimoTexto || MENSAGEM_VAZIA);
    }
    // A pessoa só pode dizer "sim" ao que viu: o antes e o depois vão na resposta mesmo que o modelo não os escreva.
    const ultimas = new Map(estado.previasMostradas.map((p) => [p.numero, p]));
    for (const p of ultimas.values()) {
      if (!estado.resposta.join('\n\n').includes(p.depois)) estado.resposta.push(`Prévia do pedido #${p.numero}:\nAntes:\n${p.antes}\nDepois:\n${p.depois}`);
    }
    return estado;
  };

  for (let i = 0; i < MAX_VOLTAS; i++) {
    const r = await d.ia.criar({ model: ctx.config.modeloConversa, max_tokens: 16000, system, tools, messages, output_config: { effort: 'medium' } });
    const uso = usoDaResposta(r.usage);
    // Uso da equipe (P6): a pessoa e o canal; nunca a conversa nem a empresa, mesmo aberto numa conversa.
    await d.repos.registrarUsoIa({ funcionalidade: ctx.canal === 'whatsapp' ? 'assistente_whatsapp' : 'assistente_site', usuarioId: ctx.usuario.id,
      conversaId: null, clienteId: null, modelo: ctx.config.modeloConversa, tokensEntrada: uso.entrada, tokensSaida: uso.saida,
      tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita, custoUsd: calcularCustoUsd(uso, preco) });
    const blocosTexto = r.content.filter((b): b is Anthropic.TextBlock => b.type === 'text' && b.text.trim() !== '');
    const texto = blocosTexto.map((b) => b.text.trim()).join('\n');
    const usos = r.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || usos.length === 0) {
      ultimoTexto = texto;
      // Nunca devolve à API um turno vazio ou cortado (tool_use pela metade em max_tokens): a requisição seguinte daria erro 400.
      if (estado.resposta.length || lembrado || !texto || r.stop_reason === 'max_tokens' || r.stop_reason === 'refusal') return fechar();
      lembrado = true;
      messages.push({ role: 'assistant', content: blocosTexto.map((b) => ({ type: 'text' as const, text: b.text })) },
        { role: 'user', content: [{ type: 'text', text: LEMBRETE }] });
      continue;
    }
    ultimoTexto = '';
    messages.push({ role: 'assistant', content: r.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const u of usos) {
      const res = extra?.nomes.has(u.name) ? await extra.executar(d, estado, u.name, u.input) : await executarFerramentaAssistente(d, estado, u.name, u.input);
      if (u.name === 'alterar_pedido_venda' && (u.input as { confirmado?: unknown } | null)?.confirmado === true) {
        falhaGravacao = res.erro ? (JSON.parse(res.resultado) as { erro: string }).erro : falhaGravacao;
      }
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.resultado, is_error: res.erro });
    }
    messages.push({ role: 'user', content: resultados });
  }
  return fechar();
}
