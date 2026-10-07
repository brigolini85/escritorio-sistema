import type { Niveis } from '@escritorio/core';
import { temNivel } from '@/lib/permissoes';

// "Pedidos de nota: Sem acesso" (P11): o painel esconde o pedido, os itens da descrição e as correções (antes/depois).
// É proteção de tela, como no assistente: o servidor tira o conteúdo antes de mandar a página ao navegador.

/** Texto no lugar do que fica escondido. */
export const AVISO_SEM_ACESSO_PEDIDO = 'Só quem tem acesso a pedidos de nota vê a descrição, os itens e as correções deste pedido.';

/** O mesmo critério do trabalhador (ehPedidoDeNota): pedido salvo ou título "NF de ...". */
export function ehPedidoDeNota(c: { titulo: string | null; pedido_venda?: unknown }): boolean {
  return (c.pedido_venda !== null && c.pedido_venda !== undefined) || (c.titulo ?? '').startsWith('NF de ');
}

// Eventos cujo texto é só um valor da própria demanda (status, prazo, setor...): continuam aparecendo.
const SEM_TEXTO_LIVRE = new Set([
  'criacao', 'prioridade_alterada', 'prazo_alterado', 'assumido', 'status_alterado', 'responsavel_alterado',
  'transferencia', 'editado', 'conclusao', 'reaberto', 'prazo_recalculado',
]);

/** Notas e eventos com texto livre (onde moram itens, preços e o antes/depois) perdem o texto. */
export function ocultarEventosDoPedido<E extends { tipo: string; texto: string | null }>(eventos: E[]): E[] {
  return eventos.map((e) => (SEM_TEXTO_LIVRE.has(e.tipo) ? e : { ...e, texto: AVISO_SEM_ACESSO_PEDIDO }));
}

/**
 * Revisão geral (painel I2): a tarefa do agente de um pedido de nota some (página, CSV, planilha e arquivos) para quem tem
 * "Pedidos de nota: Sem acesso". O banco já esconde a demanda com pedido salvo; o título "NF de ..." sem pedido fica com o painel.
 */
export function tarefaDoPedidoEscondida(u: { papel: 'admin' | 'atendente'; niveis: Niveis }, t: { demanda: { pedidoDeNota?: boolean } }): boolean {
  return t.demanda.pedidoDeNota === true && !temNivel(u, 'notas', 'ver');
}
