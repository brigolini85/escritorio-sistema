import { describe, expect, it } from 'vitest';
import { AVISO_SEM_ACESSO_PEDIDO, ehPedidoDeNota, ocultarEventosDoPedido, tarefaDoPedidoEscondida } from './pedido-nota';

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
      { tipo: 'prazo_recalculado', texto: '2026-10-13T21:00:00Z', criado_em: 't5', usuario: 'Thiago' },
    ];
    expect(ocultarEventosDoPedido(eventos)).toEqual([
      { tipo: 'nota_interna', texto: AVISO_SEM_ACESSO_PEDIDO, criado_em: 't1', usuario: 'Ana' },
      { tipo: 'status_alterado', texto: 'em_andamento', criado_em: 't2', usuario: null },
      { tipo: 'transferencia', texto: 'Fiscal', criado_em: 't3', usuario: null },
      { tipo: 'outro_tipo', texto: AVISO_SEM_ACESSO_PEDIDO, criado_em: 't4', usuario: null },
      { tipo: 'prazo_recalculado', texto: '2026-10-13T21:00:00Z', criado_em: 't5', usuario: 'Thiago' },
    ]);
  });
});

// Revisão geral (painel I2): a tarefa do agente de um pedido de nota segue a mesma regra das outras telas.
describe('tarefaDoPedidoEscondida', () => {
  const t = (pedidoDeNota?: boolean) => ({ demanda: { pedidoDeNota } });
  const sem = { papel: 'atendente' as const, niveis: { notas: 'sem_acesso' } as never };
  const ver = { papel: 'atendente' as const, niveis: { notas: 'ver' } as never };
  const admin = { papel: 'admin' as const, niveis: {} as never };
  it('esconde só tarefa de pedido de nota de quem tem Pedidos de nota: Sem acesso', () => {
    expect(tarefaDoPedidoEscondida(sem, t(true))).toBe(true);
    expect(tarefaDoPedidoEscondida(sem, t(false))).toBe(false);
    expect(tarefaDoPedidoEscondida(sem, t())).toBe(false);
    expect(tarefaDoPedidoEscondida(ver, t(true))).toBe(false);
    expect(tarefaDoPedidoEscondida(admin, t(true))).toBe(false);
  });
});
