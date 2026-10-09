import { beforeEach, describe, expect, it, vi } from 'vitest';

// Segurança do login (item 8): redirecionamento de ação de servidor não passa pelo middleware; obterUsuario (todas as
// telas do painel) também manda quem precisa do segundo fator e está em aal1 para /segundo-fator.
// Auditoria 2.1: quem decide é exige_segundo_fator (o banco esconde a própria linha em aal1), perguntado antes da leitura.
const falso = vi.hoisted(() => ({ linha: null as unknown, nivel: 'aal1', exige: false, leituras: 0 }));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } } }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: falso.nivel }, error: null }) },
    },
    rpc: async (nome: string) => (nome === 'exige_segundo_fator'
      ? { data: falso.exige, error: null }
      : { data: { situacao: 'liberado' }, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
      falso.leituras += 1;
      return { data: falso.linha, error: null };
    } }) }) }),
  }),
}));
import { obterUsuario } from './sessao';

const linha = (extra: object) => ({ id: 'u1', nome: 'Ana', papel: 'atendente', ativo: true, tamanho_letra: null,
  usuario_setores: [], usuario_permissoes: [], ...extra });

beforeEach(() => { falso.nivel = 'aal1'; falso.exige = false; falso.leituras = 0; });

describe('obterUsuario e o segundo fator', () => {
  it('administrador em aal1: vai para /segundo-fator sem ler a própria linha', async () => {
    falso.linha = null; // em aal1 o banco não entrega a linha de quem precisa do fator
    falso.exige = true;
    await expect(obterUsuario()).rejects.toThrow('REDIRECT /segundo-fator');
    expect(falso.leituras).toBe(0);
  });
  it('quem vê acessos de portais em aal1: vai para /segundo-fator', async () => {
    falso.linha = null;
    falso.exige = true;
    await expect(obterUsuario()).rejects.toThrow('REDIRECT /segundo-fator');
  });
  it('administrador em aal2: segue', async () => {
    falso.linha = linha({ papel: 'admin' });
    falso.exige = true;
    falso.nivel = 'aal2';
    await expect(obterUsuario()).resolves.toMatchObject({ papel: 'admin' });
  });
  it('atendente sem a permissão: segue em aal1', async () => {
    falso.linha = linha({});
    await expect(obterUsuario()).resolves.toMatchObject({ papel: 'atendente' });
  });
});
