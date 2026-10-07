import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Revisão geral (painel I2): CSV, planilha e arquivos da tarefa de um pedido de nota não saem para quem tem
// "Pedidos de nota: Sem acesso" (o resto do painel já esconde o pedido; o banco só esconde demanda com pedido_venda).
const falso = vi.hoisted(() => ({
  usuario: { id: 'u1', papel: 'atendente', niveis: { notas: 'sem_acesso' }, setores: [] } as Record<string, unknown>,
  tarefa: null as unknown, auditoria: vi.fn(), arquivo: null as unknown, chamado: null as unknown,
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => falso.usuario }));
vi.mock('@/lib/auditoria', () => ({ registrarAuditoria: falso.auditoria }));
vi.mock('@/lib/tarefas', () => ({ lerTarefa: async () => ({ tarefa: falso.tarefa, semI3: false }) }));
vi.mock('@/lib/planilha-tarefa', () => ({ planilhaDaTarefa: () => new Uint8Array([1, 2, 3]) }));
vi.mock('@/lib/supabase/servico', () => ({
  supabaseServico: () => ({ storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: 'https://x/assinado' }, error: null }) }) } }),
}));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    from: (tabela: string) => {
      const dados = tabela === 'agente_tarefa_arquivos' ? falso.arquivo : falso.chamado;
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: dados, error: null }) };
      return q;
    },
    rpc: async () => ({ data: true, error: null }),
  }),
}));

import { GET as csv } from './csv/route';
import { GET as planilha } from './planilha/route';
import { GET as arquivo } from './arquivo/route';

const ID = '11111111-1111-4111-8111-111111111111';
const pedido = (url: string) => new NextRequest(`http://localhost${url}?id=${ID}`);
const resultado = { versao: 1, resumo: 'ok', destaques: [], linhas: [], observacoes: null };
function tarefa(pedidoDeNota: boolean) {
  return { id: ID, numero: 1, estado: 'pronta', demanda: { id: 'd', numero: 7, titulo: pedidoDeNota ? 'NF de Padaria' : 'Folha', pedidoDeNota }, resultado, empresa: null };
}

beforeEach(() => {
  falso.usuario = { id: 'u1', papel: 'atendente', niveis: { notas: 'sem_acesso' }, setores: [] };
  falso.auditoria.mockReset();
  falso.arquivo = { tarefa_id: ID, origem: 'enviado', bucket: 'tarefas', caminho: 'x/y.pdf', nome: 'y.pdf', mensagem_id: null, removido_em: null };
  falso.chamado = { chamados: { titulo: 'NF de Padaria', pedido_venda: null } };
});

describe('downloads da tarefa de pedido de nota', () => {
  it('CSV: 404 para quem tem Pedidos de nota: Sem acesso, sem auditoria de download', async () => {
    falso.tarefa = tarefa(true);
    expect((await csv(pedido('/api/tarefas/csv'))).status).toBe(404);
    expect(falso.auditoria).not.toHaveBeenCalled();
  });
  it('planilha: 404 para quem tem Pedidos de nota: Sem acesso', async () => {
    falso.tarefa = tarefa(true);
    expect((await planilha(pedido('/api/tarefas/planilha'))).status).toBe(404);
  });
  it('quem vê pedidos de nota baixa normalmente', async () => {
    falso.usuario = { ...falso.usuario, niveis: { notas: 'ver' } };
    falso.tarefa = tarefa(true);
    expect((await csv(pedido('/api/tarefas/csv'))).status).toBe(200);
    expect((await planilha(pedido('/api/tarefas/planilha'))).status).toBe(200);
  });
  it('tarefa que não é de pedido de nota continua saindo', async () => {
    falso.tarefa = tarefa(false);
    expect((await csv(pedido('/api/tarefas/csv'))).status).toBe(200);
  });
  it('arquivo: 404 quando a demanda da tarefa é pedido de nota e a pessoa não vê pedidos', async () => {
    expect((await arquivo(pedido('/api/tarefas/arquivo'))).status).toBe(404);
    expect(falso.auditoria).not.toHaveBeenCalled();
  });
  it('arquivo: sai (redirect para o link assinado) quando não é pedido de nota', async () => {
    falso.chamado = { chamados: { titulo: 'Folha', pedido_venda: null } };
    const r = await arquivo(pedido('/api/tarefas/arquivo'));
    expect(r.status).toBe(307);
  });
});
