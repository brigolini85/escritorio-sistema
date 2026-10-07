import { beforeEach, describe, expect, it, vi } from 'vitest';

// Segurança do login (item 8): redirecionamento de ação de servidor não passa pelo middleware; obterUsuario (todas as
// telas do painel) também manda quem precisa do segundo fator e está em aal1 para /segundo-fator.
const falso = vi.hoisted(() => ({ linha: null as unknown, nivel: 'aal1' }));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } } }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: falso.nivel }, error: null }) },
    },
    rpc: async () => ({ data: { situacao: 'liberado' }, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: falso.linha, error: null }) }) }) }),
  }),
}));
import { obterUsuario } from './sessao';

const linha = (extra: object) => ({ id: 'u1', nome: 'Ana', papel: 'atendente', ativo: true, tamanho_letra: null, ver_acessos_portais: false,
  usuario_setores: [], usuario_permissoes: [], ...extra });

beforeEach(() => { falso.nivel = 'aal1'; });

describe('obterUsuario e o segundo fator', () => {
  it('administrador em aal1: vai para /segundo-fator', async () => {
    falso.linha = linha({ papel: 'admin' });
    await expect(obterUsuario()).rejects.toThrow('REDIRECT /segundo-fator');
  });
  it('quem vê acessos de portais em aal1: vai para /segundo-fator', async () => {
    falso.linha = linha({ ver_acessos_portais: true });
    await expect(obterUsuario()).rejects.toThrow('REDIRECT /segundo-fator');
  });
  it('administrador em aal2: segue', async () => {
    falso.linha = linha({ papel: 'admin' });
    falso.nivel = 'aal2';
    await expect(obterUsuario()).resolves.toMatchObject({ papel: 'admin' });
  });
  it('atendente sem a permissão: segue em aal1', async () => {
    falso.linha = linha({});
    await expect(obterUsuario()).resolves.toMatchObject({ papel: 'atendente' });
  });
});
