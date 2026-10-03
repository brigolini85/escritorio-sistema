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
  'transferencia', 'editado', 'conclusao', 'reaberto',
]);

/** Notas e eventos com texto livre (onde moram itens, preços e o antes/depois) perdem o texto. */
export function ocultarEventosDoPedido<E extends { tipo: string; texto: string | null }>(eventos: E[]): E[] {
  return eventos.map((e) => (SEM_TEXTO_LIVRE.has(e.tipo) ? e : { ...e, texto: AVISO_SEM_ACESSO_PEDIDO }));
}
