import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Auditoria 2.10: download sem rastro não sai. A auditoria vem antes de assinar o link (ou de montar o arquivo); se ela
// falhar, a rota responde 503 e não assina nada.
const falso = vi.hoisted(() => ({ auditoria: vi.fn(), assinar: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'admin', niveis: {}, setores: [] }) }));
vi.mock('@/lib/auditoria', () => ({ registrarAuditoria: falso.auditoria }));
vi.mock('@/lib/permissoes', () => ({ temNivel: () => true }));
vi.mock('@/lib/tarefas', () => ({
  lerTarefa: async () => ({
    tarefa: { id: 'x', numero: 1, estado: 'pronta', demanda: { id: 'd', numero: 7, titulo: 'Folha', pedidoDeNota: false }, resultado: { versao: 1, resumo: 'ok', destaques: [], linhas: [], observacoes: null }, empresa: null },
    semI3: false,
  }),
}));
vi.mock('@/lib/planilha-tarefa', () => ({ planilhaDaTarefa: () => new Uint8Array([1, 2, 3]) }));
vi.mock('@/lib/bling', () => ({ carregarPedidosBling: async () => ({ pedidos: [{ numero: 1 }], problemas: [] }), escolherParte: () => 1 }));
vi.mock('@escritorio/core', async (original) => ({
  ...(await original<typeof import('@escritorio/core')>()),
  dividirPedidosBling: (p: unknown[]) => [p],
  montarCsvVendaBling: () => 'csv',
}));
const storage = { from: () => ({ createSignedUrl: falso.assinar }) };
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({ storage }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    storage,
    from: (tabela: string) => {
      const dados = tabela === 'documentos_empresa' ? { arquivo_path: 'clientes/c/doc.pdf' }
        : tabela === 'agente_tarefa_arquivos' ? { tarefa_id: 't', origem: 'enviado', bucket: 'tarefas', caminho: 'x/y.pdf', nome: 'y.pdf', mensagem_id: null, removido_em: null }
          : null;
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: dados, error: null }) };
      return q;
    },
    rpc: async () => ({ data: true, error: null }),
  }),
}));

import { GET as arquivos } from './arquivos/route';
import { GET as csvBling } from './csv-bling/route';
import { GET as documentos } from './documentos/route';
import { GET as arquivoTarefa } from './tarefas/arquivo/route';
import { GET as csvTarefa } from './tarefas/csv/route';
import { GET as planilhaTarefa } from './tarefas/planilha/route';

const ID = '11111111-1111-4111-8111-111111111111';
const pedido = (caminho: string) => new NextRequest(`http://localhost${caminho}`);

beforeEach(() => {
  falso.auditoria.mockReset();
  falso.auditoria.mockRejectedValue(new Error('banco fora'));
  falso.assinar.mockReset();
  falso.assinar.mockResolvedValue({ data: { signedUrl: 'https://x/assinado' }, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('auditoria falhando: 503 e nada assinado', () => {
  it.each([
    ['anexo', () => arquivos(pedido('/api/arquivos?path=conversas/a.pdf'))],
    ['documento', () => documentos(pedido(`/api/documentos?id=${ID}`))],
    ['arquivo da tarefa', () => arquivoTarefa(pedido(`/api/tarefas/arquivo?id=${ID}`))],
  ])('%s: 503 sem createSignedUrl', async (_, chamar) => {
    const r = await chamar();
    expect(r.status).toBe(503);
    expect(falso.assinar).not.toHaveBeenCalled();
  });
  it.each([
    ['CSV da tarefa', () => csvTarefa(pedido(`/api/tarefas/csv?id=${ID}`))],
    ['planilha da tarefa', () => planilhaTarefa(pedido(`/api/tarefas/planilha?id=${ID}`))],
    ['CSV do Bling', () => csvBling(pedido(`/api/csv-bling?id=${ID}`))],
  ])('%s: 503 sem o arquivo', async (_, chamar) => {
    const r = await chamar();
    expect(r.status).toBe(503);
    expect(r.headers.get('content-disposition')).toBeNull();
  });
});

describe('auditoria gravada: o download sai como antes', () => {
  beforeEach(() => falso.auditoria.mockResolvedValue(undefined));
  it('documento: redireciona para o link assinado, depois da auditoria', async () => {
    const r = await documentos(pedido(`/api/documentos?id=${ID}`));
    expect(r.status).toBe(307);
    expect(falso.auditoria.mock.invocationCallOrder[0]!).toBeLessThan(falso.assinar.mock.invocationCallOrder[0]!);
  });
  it('anexo e arquivo da tarefa: auditoria antes de assinar', async () => {
    expect((await arquivos(pedido('/api/arquivos?path=conversas/a.pdf'))).status).toBe(307);
    expect((await arquivoTarefa(pedido(`/api/tarefas/arquivo?id=${ID}`))).status).toBe(307);
    expect(falso.auditoria.mock.invocationCallOrder[1]!).toBeLessThan(falso.assinar.mock.invocationCallOrder[1]!);
  });
  it('CSV da tarefa: 200 com o arquivo', async () => {
    expect((await csvTarefa(pedido(`/api/tarefas/csv?id=${ID}`))).status).toBe(200);
  });
});
