import { describe, expect, it, vi } from 'vitest';

// Auditoria 2.10: falha ao gravar a auditoria não fica só no log; quem chama decide (download responde 503).
vi.mock('server-only', () => ({}));
const falso = vi.hoisted(() => ({ erro: null as { message: string } | null, insert: vi.fn() }));
vi.mock('./supabase/servico', () => ({
  supabaseServico: () => ({ from: () => ({ insert: async (linha: unknown) => { falso.insert(linha); return { error: falso.erro }; } }) }),
}));
import { registrarAuditoria } from './auditoria';

describe('registrarAuditoria', () => {
  it('grava a linha', async () => {
    falso.erro = null;
    await expect(registrarAuditoria('u1', 'download', 'documento', 'd1')).resolves.toBeUndefined();
    expect(falso.insert).toHaveBeenCalledWith({ usuario_id: 'u1', acao: 'download', entidade: 'documento', entidade_id: 'd1', detalhes: null });
  });
  it('erro do banco: lança', async () => {
    falso.erro = { message: 'connection refused' };
    await expect(registrarAuditoria('u1', 'download', 'documento', 'd1')).rejects.toThrow('connection refused');
  });
});
