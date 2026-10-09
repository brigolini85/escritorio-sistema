import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Segurança do login (item 8): quem precisa do segundo fator e está em aal1 vai para /segundo-fator antes de tudo.
const falso = vi.hoisted(() => ({ aal: 'aal1', exige: true as boolean | null, situacao: 'liberado', rpcs: [] as string[] }));
const token = () => `cab.${Buffer.from(JSON.stringify({ session_id: 's1', aal: falso.aal, amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] })).toString('base64url')}.ass`;
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } } }),
      getSession: async () => ({ data: { session: { access_token: token() } } }),
      signOut: async () => ({ error: null }),
    },
    rpc: async (nome: string) => {
      falso.rpcs.push(nome);
      if (nome === 'situacao_acesso') return { data: { situacao: falso.situacao }, error: null };
      return falso.exige === null ? { data: null, error: { message: 'caiu' } } : { data: falso.exige, error: null };
    },
  }),
}));
import { middleware } from './middleware';

const pedir = (c: string, accept?: string) => middleware(new NextRequest(`http://localhost${c}`, { headers: accept ? { accept } : {} }));

beforeEach(() => {
  Object.assign(falso, { aal: 'aal1', exige: true, situacao: 'liberado', rpcs: [] });
  vi.stubEnv('PAINEL_SEGREDO_SESSAO', 'segredo-de-teste-com-mais-de-32-caracteres');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('middleware: segundo fator', () => {
  it('administrador em aal1: qualquer página vai para /segundo-fator', async () => {
    for (const c of ['/inicio', '/clientes/123', '/usuarios']) {
      expect((await pedir(c)).headers.get('location')).toBe('http://localhost/segundo-fator');
    }
  });
  it('a própria tela abre (sem laço)', async () => {
    expect((await pedir('/segundo-fator')).headers.get('location')).toBeNull();
  });
  it('/api/* por código: 401', async () => {
    const r = await pedir('/api/busca?q=x');
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erro: 'confirme o segundo fator' });
  });
  it('aal2: segue e nem pergunta ao banco', async () => {
    falso.aal = 'aal2';
    expect((await pedir('/inicio')).headers.get('location')).toBeNull();
    expect(falso.rpcs).toEqual(['situacao_acesso']);
  });
  it('quem não precisa: segue em aal1', async () => {
    falso.exige = false;
    expect((await pedir('/inicio')).headers.get('location')).toBeNull();
  });
  it('erro ao perguntar: não tranca a tela (o banco segue recusando as ações sensíveis)', async () => {
    falso.exige = null;
    expect((await pedir('/inicio')).headers.get('location')).toBeNull();
  });
  it('fora do horário: a tela do horário vem antes', async () => {
    falso.situacao = 'fora_do_horario';
    expect((await pedir('/inicio')).headers.get('location')).toBe('http://localhost/fora-do-horario');
  });
});
