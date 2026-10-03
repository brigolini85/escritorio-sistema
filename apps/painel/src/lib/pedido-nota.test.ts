import { describe, expect, it } from 'vitest';
import { AVISO_SEM_ACESSO_PEDIDO, ehPedidoDeNota, ocultarEventosDoPedido } from './pedido-nota';

describe('pedido de nota para quem tem "Pedidos de nota: Sem acesso" (P11)', () => {
  it('mesmo critério do trabalhador: pedido salvo ou título "NF de ..."', () => {
    expect(ehPedidoDeNota({ titulo: 'Folha de outubro', pedido_venda: { itens: [] } })).toBe(true);
    expect(ehPedidoDeNota({ titulo: 'NF de Padaria', pedido_venda: null })).toBe(true);
    expect(ehPedidoDeNota({ titulo: 'Folha de outubro', pedido_venda: null })).toBe(false);
    expect(ehPedidoDeNota({ titulo: 'Folha de outubro' })).toBe(false);
    expect(ehPedidoDeNota({ titulo: null, pedido_venda: null })).toBe(false);
  });
  it('notas e eventos com texto livre perdem o texto; status, prazo e transferência continuam', () => {
    const eventos = [
      { tipo: 'nota_interna', texto: 'Antes:\n10 Costela\nDepois:\n12 Costela', criado_em: 't1', usuario: 'Ana' },
      { tipo: 'status_alterado', texto: 'em_andamento', criado_em: 't2', usuario: null },
      { tipo: 'transferencia', texto: 'Fiscal', criado_em: 't3', usuario: null },
      { tipo: 'outro_tipo', texto: 'R$ 9,50', criado_em: 't4', usuario: null },
    ];
    expect(ocultarEventosDoPedido(eventos)).toEqual([
      { tipo: 'nota_interna', texto: AVISO_SEM_ACESSO_PEDIDO, criado_em: 't1', usuario: 'Ana' },
      { tipo: 'status_alterado', texto: 'em_andamento', criado_em: 't2', usuario: null },
      { tipo: 'transferencia', texto: 'Fiscal', criado_em: 't3', usuario: null },
      { tipo: 'outro_tipo', texto: AVISO_SEM_ACESSO_PEDIDO, criado_em: 't4', usuario: null },
    ]);
  });
});
