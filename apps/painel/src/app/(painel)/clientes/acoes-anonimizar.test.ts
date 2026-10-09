import { beforeEach, describe, expect, it, vi } from 'vitest';

// Revisão geral (painel I6): anonimizar_contato já apagou no banco e devolveu os caminhos dos arquivos. Se a fila falhar,
// os arquivos não podem ficar órfãos calados: tenta remover na hora e, o que sobrar, fica registrado e a pessoa é avisada.
const falso = vi.hoisted(() => ({
  rpc: vi.fn(), fila: vi.fn(), remover: vi.fn(), auditoria: vi.fn(), buckets: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/fila', () => ({ enfileirarRemocaoArquivos: falso.fila }));
vi.mock('@/lib/auditoria', () => ({ registrarAuditoria: falso.auditoria }));
vi.mock('@/lib/cadastro-contato', () => ({ cadastrarContatoPeloTelefone: vi.fn(), lerManter: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ exigirAdmin: async () => ({ id: 'adm', papel: 'admin' }), obterUsuario: async () => ({ id: 'adm', papel: 'admin' }) }));
vi.mock('@/lib/permissoes', () => ({ temNivel: () => true }));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ rpc: falso.rpc }) }));
vi.mock('@/lib/supabase/servico', () => ({
  supabaseServico: () => ({ storage: { from: (b: string) => ({ remove: (p: string[]) => { falso.buckets.push(b); return falso.remover(b, p); } }) } }),
}));

import { anonimizarContato } from './acoes';

const PATHS = ['conversas/c1/a.ogg', 't1/b.pdf'];
const form = () => { const f = new FormData(); f.set('confirmo', 'on'); return f; };
beforeEach(() => {
  falso.rpc.mockReset().mockResolvedValue({ data: PATHS, error: null });
  falso.fila.mockReset().mockResolvedValue(undefined);
  falso.remover.mockReset().mockResolvedValue({ data: [], error: null });
  falso.auditoria.mockReset();
  falso.buckets = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('anonimizarContato e a remoção dos arquivos', () => {
  it('caminho normal: enfileira e não avisa nada', async () => {
    expect(await anonimizarContato('cli', 'ct', form())).toBeUndefined();
    expect(falso.fila).toHaveBeenCalledWith(PATHS);
    expect(falso.remover).not.toHaveBeenCalled();
  });
  it('fila fora: remove na hora, cada caminho no seu compartimento', async () => {
    falso.fila.mockRejectedValue(new Error('pg-boss fora'));
    expect(await anonimizarContato('cli', 'ct', form())).toBeUndefined();
    expect(falso.remover).toHaveBeenCalledWith('anexos', ['conversas/c1/a.ogg']);
    expect(falso.remover).toHaveBeenCalledWith('tarefas', ['t1/b.pdf']);
    expect(falso.auditoria).not.toHaveBeenCalled();
  });
  it('fila e remoção falham: registra o pendente (auditoria) e devolve o aviso, sem lançar', async () => {
    falso.fila.mockRejectedValue(new Error('pg-boss fora'));
    falso.remover.mockImplementation(async (b: string) => (b === 'tarefas' ? { data: null, error: { message: 'storage fora' } } : { data: [], error: null }));
    const r = await anonimizarContato('cli', 'ct', form());
    expect(r?.aviso).toMatch(/1 arquivo/);
    expect(falso.auditoria).toHaveBeenCalledWith('adm', 'remocao_pendente', 'arquivos_lgpd', 'ct', { paths: ['t1/b.pdf'] });
    expect(console.error).toHaveBeenCalled();
  });
  // Auditoria 2.10: registrarAuditoria passou a lançar; aqui o banco já apagou, então o aviso continua saindo.
  it('auditoria do pendente também falha: devolve o aviso mesmo assim, sem lançar', async () => {
    falso.fila.mockRejectedValue(new Error('pg-boss fora'));
    falso.remover.mockResolvedValue({ data: null, error: { message: 'storage fora' } });
    falso.auditoria.mockRejectedValue(new Error('banco fora'));
    const r = await anonimizarContato('cli', 'ct', form());
    expect(r?.aviso).toMatch(/arquivo/);
  });
});
