import { randomUUID } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { calcularCustoUsd, usoDaResposta } from '@escritorio/core';
import type { ParametrosIa } from './cliente-ia';
import type { ContextoAgente } from './contexto';
import { NOMES_FERRAMENTAS, executarFerramenta, falha, type DepsAgente, type EstadoExecucao, type ExecutorFerramentas } from './ferramentas';
import { LIMITE_ORIENTACOES } from './orientacoes';
import { ferramentasDoPerfil, modeloDoPerfil, perfilDoContexto } from './perfil';
import { montarBlocosSistema } from './prompt';

export const MAX_ITERACOES = 6;
const LEMBRETE_RESPONDER =
  'Nada foi enviado ao cliente: texto fora das ferramentas não chega a ele. Use a ferramenta responder para falar com o cliente (ou abra um chamado, se for o caso).';
/** `respondeu`: se o agente mandou alguma mensagem ao cliente neste turno (antes de escalar). */
export type ResultadoAgente = { status: 'ok' } | { status: 'escalar'; motivo: string; respondeu: boolean };

async function registrarUso(d: DepsAgente, ctx: ContextoAgente, r: Anthropic.Message): Promise<void> {
  const perfil = perfilDoContexto(ctx);
  const modelo = modeloDoPerfil(perfil, ctx.config);
  const preco = ctx.config.precosModelos[modelo] ?? { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  const uso = usoDaResposta(r.usage);
  // A simulação troca o repositório e grava como testar_agente (agente/simular.ts). O agente vai junto (D16).
  await d.repos.registrarUsoIa({
    funcionalidade: 'agente_clientes', usuarioId: null, conversaId: ctx.conversa.id, clienteId: ctx.empresaEmFoco?.id ?? null, modelo, tokensEntrada: uso.entrada, tokensSaida: uso.saida,
    tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita, custoUsd: calcularCustoUsd(uso, preco), agenteId: perfil.id,
  });
}

/** O pedido de uma rodada (Parte I1): o de antes, com o modelo e as ferramentas do perfil. Mesma ordem de chaves (D2). */
export function montarPedido(ctx: ContextoAgente, messages: Anthropic.MessageParam[]): { pedido: ParametrosIa; cortadas: string[] } {
  const perfil = perfilDoContexto(ctx);
  const { system, cortadas } = montarBlocosSistema(ctx);
  return {
    pedido: { model: modeloDoPerfil(perfil, ctx.config), max_tokens: 16000, system, tools: ferramentasDoPerfil(perfil), messages, output_config: { effort: 'medium' } },
    cortadas,
  };
}

/** Registra as orientações que ficaram de fora do prompt, só quando a lista muda em relação ao último registro da conversa. */
async function registrarCortes(d: DepsAgente, ctx: ContextoAgente, cortadas: string[]): Promise<void> {
  const ordenadas = [...cortadas].sort();
  const anterior = await d.repos.ultimasOrientacoesCortadas(ctx.conversa.id);
  if (anterior && [...anterior].sort().join(',') === ordenadas.join(',')) return;
  await d.repos.registrarDecisao({
    conversaId: ctx.conversa.id, clienteId: ctx.empresaEmFoco?.id ?? null, etapa: 'orientacoes_cortadas',
    entrada: { limite: LIMITE_ORIENTACOES }, saida: { cortadas: ordenadas },
    justificativa: 'Orientações ligadas passaram do limite de caracteres do prompt; as de menor prioridade ficaram de fora.',
  });
}

/** `executor`: a simulação (Treinar o agente) troca as ferramentas que gravam ou enviam por versões que só registram. */
export async function executarAgente(
  d: DepsAgente, ctx: ContextoAgente, conteudo: Anthropic.ContentBlockParam[], executor: ExecutorFerramentas = executarFerramenta,
): Promise<ResultadoAgente> {
  let cortesVerificados = false;
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: conteudo }];
  // Um turno por execução: liga as decisões às mensagens que o agente mandou (o "por quê?" do painel).
  const estado: EstadoExecucao = { ctx, respondeu: false, turno: randomUUID() };
  let lembrado = false;

  for (let i = 0; i < MAX_ITERACOES; i++) {
    // A cada rodada: selecionar_empresa pode ter trocado a empresa em foco (e com ela as orientações da empresa).
    const { pedido, cortadas } = montarPedido(ctx, messages);
    const r = await d.ia.criar(pedido);
    await registrarUso(d, ctx, r);
    // Só depois de a IA responder: o registro não pode contar como "o agente já agiu" numa falha temporária antes disso.
    if (cortadas.length && !cortesVerificados) {
      cortesVerificados = true;
      await registrarCortes(d, ctx, cortadas);
    }

    if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') return { status: 'escalar', motivo: r.stop_reason, respondeu: estado.respondeu };
    const usos = r.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || usos.length === 0) {
      if (estado.respondeu) return { status: 'ok' };
      // Às vezes o modelo escreve a resposta como texto em vez de usar a ferramenta: um lembrete antes de escalar.
      // Sem lembrete se já lembrou, ou se um atendente assumiu a conversa (aí o agente não deve falar).
      if (lembrado || (await d.repos.obterConversa(ctx.conversa.id)).estado === 'humano') {
        return { status: 'escalar', motivo: 'terminou sem responder', respondeu: false };
      }
      lembrado = true;
      messages.push({ role: 'assistant', content: r.content });
      messages.push({ role: 'user', content: [{ type: 'text', text: LEMBRETE_RESPONDER }] });
      continue;
    }

    messages.push({ role: 'assistant', content: r.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    const liberadas = new Set((pedido.tools ?? []).map((t) => (t as Anthropic.Tool).name));
    // Em ordem: selecionar_empresa precisa valer antes de abrir_chamado na mesma rodada.
    for (const u of usos) {
      // Ferramenta conhecida fora do perfil não roda (D15); nome desconhecido segue o caminho de sempre (o executor recusa).
      const res = NOMES_FERRAMENTAS.has(u.name) && !liberadas.has(u.name)
        ? falha(`Ferramenta não liberada para este agente: ${u.name}.`)
        : await executor(d, estado, u.name, u.input);
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.resultado, is_error: res.erro });
    }
    messages.push({ role: 'user', content: resultados });
  }
  return estado.respondeu ? { status: 'ok' } : { status: 'escalar', motivo: 'limite de iterações', respondeu: false };
}
