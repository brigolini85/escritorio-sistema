import { beforeEach, describe, expect, it, vi } from 'vitest';

// obterUsuario com o Supabase falso: sem a própria linha, a situação de acesso decide; erro do banco não é "desativado".
const falso = vi.hoisted(() => ({
  linha: null as unknown,
  erroLinha: null as { message: string } | null,
  rpc: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }), signOut: falso.signOut },
    rpc: falso.rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: falso.linha, error: falso.erroLinha }) }) }) }),
  }),
}));

import { obterUsuario } from './sessao';

beforeEach(() => {
  falso.linha = null;
  falso.erroLinha = null;
  falso.rpc.mockReset();
  falso.signOut.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('obterUsuario sem a própria linha', () => {
  it('erro do banco na situação: tente de novo, sem deslogar', async () => {
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    await expect(obterUsuario()).rejects.toThrow('REDIRECT /entrar?erro=indisponivel');
    expect(falso.signOut).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
  it('erro do banco ao ler a linha: tente de novo, mesmo que a situação diga liberado', async () => {
    falso.erroLinha = { message: 'timeout' };
    falso.rpc.mockResolvedValue({ data: { situacao: 'liberado' }, error: null });
    await expect(obterUsuario()).rejects.toThrow('REDIRECT /entrar?erro=indisponivel');
    expect(console.error).toHaveBeenCalled();
  });
  it('fora do horário vai para a página do horário', async () => {
    falso.rpc.mockResolvedValue({ data: { situacao: 'fora_do_horario' }, error: null });
    await expect(obterUsuario()).rejects.toThrow('REDIRECT /fora-do-horario');
  });
  it('arquivada: acesso desativado', async () => {
    falso.linha = { ativo: false };
    falso.rpc.mockResolvedValue({ data: { situacao: 'inativo' }, error: null });
    await expect(obterUsuario()).rejects.toThrow('REDIRECT /entrar?erro=inativo');
  });
});
