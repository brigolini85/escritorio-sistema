import type Anthropic from '@anthropic-ai/sdk';
import { LIMITES_TAREFA, calcularCustoUsd, usoDaResposta, type MotivoFimVez } from '@escritorio/core';
import type { Configuracoes, Repos } from '@escritorio/db';
import type { ClienteIa } from '../agente/cliente-ia';
import { modeloDoPerfil } from '../agente/perfil';
import type { Fila } from '../fila';
import type { ArmazenamentoMidia } from '../midia/armazenamento';
import { executarFerramentaTarefa, ferramentasDaTarefa, type VezDaTarefa } from './ferramentas';
import { montarSituacaoTarefa } from './prompt';

export type DepsTarefa = { repos: Repos; ia: ClienteIa; midia: Pick<ArmazenamentoMidia, 'ler'>; fila: Fila; relogio: () => Date };
export const LEMBRETE_TAREFA =
  'Nada foi registrado: texto fora das ferramentas não chega a ninguém. Termine com entregar_resultado ou abra as pendências com abrir_pendencia (e anote onde parou).';
/** F6: a fila desiste do job em 30 min (expireInSeconds 1800); depois de 20 min a vez não abre rodada nova e volta à fila. */
export const MINUTOS_POR_VEZ = 20;

/**
 * Uma vez da tarefa (D6): até LIMITES_TAREFA.rodadasPorVez rodadas. Antes de cada chamada confere o estado (a pessoa pode ter pausado)
 * e os limites de custo e de tempo (D13). Cada chamada grava o custo com a tarefa e soma na etapa atual (D12).
 */
export async function executarTarefa(
  d: DepsTarefa, vez: VezDaTarefa, config: Configuracoes, sistema: Anthropic.TextBlockParam[], inicio: Date,
): Promise<MotivoFimVez> {
  const t = vez.tarefa;
  const modelo = modeloDoPerfil(vez.perfil, config);
  const preco = config.precosModelos[modelo] ?? { entrada: 0, saida: 0, cacheLeitura: 0, cacheEscrita: 0 };
  const tools = ferramentasDaTarefa(vez.perfil);
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: [{ type: 'text', text: montarSituacaoTarefa(t, inicio) }] }];
  let lembrado = false;
  for (let i = 0; i < LIMITES_TAREFA.rodadasPorVez; i++) {
    const s = await d.repos.situacaoTarefa(t.id);
    if (!s || s.estado !== 'trabalhando') return 'fim';
    if (s.custoUsd >= s.limiteUsd) return 'limite_custo';
    const segundosNaVez = (d.relogio().getTime() - inicio.getTime()) / 1000;
    if (s.segundosTrabalhando + segundosNaVez >= s.limiteMinutos * 60) return 'limite_tempo';
    if (segundosNaVez >= MINUTOS_POR_VEZ * 60) return 'continuar';
    const r = await d.ia.criar({ model: modelo, max_tokens: 16000, system: sistema, tools, messages, output_config: { effort: 'medium' } });
    const uso = usoDaResposta(r.usage);
    const custo = calcularCustoUsd(uso, preco);
    await d.repos.registrarUsoIa({
      funcionalidade: 'especialista_setor', usuarioId: t.pedidaPor, conversaId: null, clienteId: t.clienteId, modelo,
      tokensEntrada: uso.entrada, tokensSaida: uso.saida, tokensCacheLeitura: uso.cacheLeitura, tokensCacheEscrita: uso.cacheEscrita,
      custoUsd: custo, agenteId: t.agenteId, tarefaId: t.id,
    });
    await d.repos.somarCustoTarefa(t.id, custo);
    if (r.stop_reason === 'refusal' || r.stop_reason === 'max_tokens') return 'falha';
    const usos = r.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (r.stop_reason !== 'tool_use' || usos.length === 0) {
      const temSaida = vez.entregou || vez.abriuPendencia || t.pendencias.some((p) => p.estado === 'aberta') || (t.resultado !== null && !t.ajustePendente);
      if (temSaida) return 'fim';
      if (lembrado) return 'sem_resultado';
      lembrado = true;
      messages.push({ role: 'assistant', content: r.content });
      messages.push({ role: 'user', content: [{ type: 'text', text: LEMBRETE_TAREFA }] });
      continue;
    }
    messages.push({ role: 'assistant', content: r.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const u of usos) {
      const res = await executarFerramentaTarefa(d, vez, u.name, u.input);
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: res.conteudo, is_error: res.erro });
    }
    messages.push({ role: 'user', content: resultados });
  }
  return 'continuar';
}
