import { beforeEach, describe, expect, it, vi } from 'vitest';

// Revisão geral (painel I7): serviços e responsáveis do contrato (ficha antiga) vão numa chamada só ao banco (uma transação),
// nunca "apagar tudo" e depois "inserir" em dois comandos.
const falso = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/fila', () => ({ enfileirarRemocaoArquivos: vi.fn() }));
vi.mock('@/lib/cadastro-contato', () => ({ cadastrarContatoPeloTelefone: vi.fn(), lerManter: vi.fn() }));
vi.mock('@/lib/sessao', () => ({
  exigirAdmin: async () => ({}),
  obterUsuario: async () => ({ papel: 'atendente', niveis: { clientes: 'editar' } }),
}));
vi.mock('@/lib/permissoes', () => ({ temNivel: () => true }));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ rpc: falso.rpc, from: falso.from }) }));

import { salvarResponsaveis, salvarServicos } from './acoes';

const CLIENTE = '11111111-1111-4111-8111-111111111111';
beforeEach(() => {
  falso.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  falso.from.mockReset();
});

describe('salvarServicos', () => {
  it('manda o conjunto inteiro numa chamada só (salvar_servicos_cliente) e não mexe na tabela direto', async () => {
    const f = new FormData();
    f.append('servico', 'a');
    f.append('servico', 'b');
    await salvarServicos(CLIENTE, f);
    expect(falso.rpc).toHaveBeenCalledWith('salvar_servicos_cliente', { p_cliente: CLIENTE, p_servicos: ['a', 'b'] });
    expect(falso.from).not.toHaveBeenCalled();
  });

  it('erro do banco aparece (nada foi apagado)', async () => {
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'falhou' } });
    await expect(salvarServicos(CLIENTE, new FormData())).rejects.toThrow('falhou');
  });
});

describe('salvarResponsaveis', () => {
  it('manda os responsáveis por setor numa chamada só (salvar_responsaveis_cliente)', async () => {
    const f = new FormData();
    f.append('setor:s1', 'u1');
    f.append('setor:s2', '');
    f.append('outro', 'x');
    await salvarResponsaveis(CLIENTE, f);
    expect(falso.rpc).toHaveBeenCalledWith('salvar_responsaveis_cliente', { p_cliente: CLIENTE, p_responsaveis: { s1: 'u1' } });
    expect(falso.from).not.toHaveBeenCalled();
  });
});
