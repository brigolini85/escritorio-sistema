import { preAnalisarPedidoNota, resumoPreAnalise, type PreAnaliseNota } from '@escritorio/core';
import type { DepsAgente, EstadoExecucao } from './ferramentas';

/** A conferência sem IA (D9) sobre o pedido gravado na demanda, com o comprador do cadastro e os preços que mudaram. */
export async function calcularPreAnalise(d: Pick<DepsAgente, 'repos'>, chamadoId: string, agora: Date): Promise<PreAnaliseNota | null> {
  const x = await d.repos.dadosParaPreAnalise(chamadoId, agora);
  if (!x?.pedido) return null;
  return preAnalisarPedidoNota({ numero: x.numero, pedido: x.pedido, comprador: x.comprador, mudancas: x.mudancas });
}

/**
 * Pedido de nota de venda aberto (pelo Thiago ou pelo agente): com o agente do setor ativo para o contato e "Conferir pedido de nota"
 * liberada, grava a pré-análise na demanda (D9). Nunca derruba o pedido: ele já foi para o setor e a pessoa confere como sempre.
 */
export async function preAnaliseNaAbertura(d: DepsAgente, estado: EstadoExecucao, chamadoId: string, setorId: string): Promise<void> {
  const candidatos = [...(estado.ctx.agentesSetor ?? []), ...(estado.ctx.agenteDevolvido ? [estado.ctx.agenteDevolvido] : [])];
  const agente = candidatos.find((a) => a.setorId === setorId && a.ferramentas.includes('conferir_pedido_nota'));
  if (!agente) return;
  try {
    // Dentro do try: até a conferência pode lançar (data inválida no diaMes do core) e o pedido já está aberto.
    const analise = await calcularPreAnalise(d, chamadoId, estado.ctx.agora);
    if (!analise) return;
    await d.repos.salvarPreAnalise(chamadoId, agente.id, analise);
    await d.repos.registrarDecisao({
      conversaId: estado.ctx.conversa.id, clienteId: estado.ctx.empresaEmFoco?.id ?? null, etapa: 'pre_analise_nota',
      entrada: { chamado_id: chamadoId }, saida: { resumo: resumoPreAnalise(analise) }, turno: estado.turno ?? null, agenteId: agente.id,
    });
  } catch (e) {
    console.error('[pré-análise] não gravada', chamadoId, e);
  }
}
