import { describe, expect, it, vi } from 'vitest';

// Revisão geral (painel I3): layout, página e ações chamam obterUsuario na mesma requisição; o React cache faz uma leitura só.
// Aqui o cache do React vira um memo simples (fora do servidor do Next ele não guarda nada).
const falso = vi.hoisted(() => ({ getUser: 0, leituras: 0 }));
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  cache: <A extends unknown[], R>(fn: (...a: A) => R) => { let guardado: R | undefined; return (...a: A) => (guardado ??= fn(...a)); },
}));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    auth: { getUser: async () => { falso.getUser += 1; return { data: { user: { id: 'u1' } } }; } },
    rpc: async () => ({ data: null, error: null }),
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => {
      falso.leituras += 1;
      return { data: { id: 'u1', nome: 'Ana', papel: 'atendente', ativo: true, tamanho_letra: null, usuario_setores: [], usuario_permissoes: [] }, error: null };
    } }) }) }),
  }),
}));

import { obterUsuario } from './sessao';

describe('obterUsuario com React cache', () => {
  it('duas chamadas na mesma requisição: um getUser e uma leitura de usuarios', async () => {
    const [a, b] = await Promise.all([obterUsuario(), obterUsuario()]);
    expect(a).toBe(b);
    expect(falso.getUser).toBe(1);
    expect(falso.leituras).toBe(1);
  });
});
