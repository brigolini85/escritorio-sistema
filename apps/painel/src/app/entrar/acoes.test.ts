import { beforeEach, describe, expect, it, vi } from 'vitest';

// Login com o Supabase falso: erro na situação de acesso não diz "desativado" nem desloga quem pode estar ativo.
const falso = vi.hoisted(() => ({
  rpc: vi.fn(),
  signOut: vi.fn(),
  cookies: { set: vi.fn(), delete: vi.fn() },
}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock('next/headers', () => ({ cookies: async () => falso.cookies }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    auth: {
      signInWithPassword: async () => ({ data: { user: { id: 'u1' } }, error: null }),
      signOut: falso.signOut,
    },
    rpc: falso.rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { tamanho_letra: null }, error: null }) }) }) }),
  }),
}));

import { entrar } from './acoes';

const form = () => {
  const f = new FormData();
  f.append('email', 'a@b.c');
  f.append('senha', 'x');
  return f;
};

beforeEach(() => {
  falso.rpc.mockReset();
  falso.signOut.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('entrar', () => {
  it('erro do banco na situação: mensagem própria, sem deslogar', async () => {
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'connection reset' } });
    await expect(entrar(form())).rejects.toThrow('REDIRECT /entrar?erro=indisponivel');
    expect(falso.signOut).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
  it('arquivada: desloga e avisa acesso desativado', async () => {
    falso.rpc.mockResolvedValue({ data: { situacao: 'inativo' }, error: null });
    await expect(entrar(form())).rejects.toThrow('REDIRECT /entrar?erro=inativo');
    expect(falso.signOut).toHaveBeenCalled();
  });
  it('fora do horário: desloga e avisa o horário', async () => {
    falso.rpc.mockResolvedValue({ data: { situacao: 'fora_do_horario' }, error: null });
    await expect(entrar(form())).rejects.toThrow('REDIRECT /entrar?erro=fora_do_horario');
    expect(falso.signOut).toHaveBeenCalled();
  });
  it('liberado: entra', async () => {
    falso.rpc.mockResolvedValue({ data: { situacao: 'liberado' }, error: null });
    await expect(entrar(form())).rejects.toThrow('REDIRECT /inicio');
    expect(falso.signOut).not.toHaveBeenCalled();
  });
});
