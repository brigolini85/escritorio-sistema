import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { assinarAtividade, COOKIE_ATIVIDADE } from '@/lib/sessao-limites';

// Segurança do login (item 7): o middleware encerra a sessão vencida (12 h desde o login ou 1 h sem uso).
const H = 60 * 60 * 1000;
const falso = vi.hoisted(() => ({ login: 0, signOut: vi.fn(), rpc: vi.fn() }));
const token = (corpo: object) => `cab.${Buffer.from(JSON.stringify(corpo)).toString('base64url')}.ass`;
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } } }),
      getSession: async () => ({ data: { session: { access_token: token({ session_id: 's1', aal: 'aal1', amr: [{ method: 'password', timestamp: Math.floor(falso.login / 1000) }] }) } } }),
      signOut: falso.signOut,
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }) },
    },
    rpc: falso.rpc,
  }),
}));
import { middleware } from './middleware';

const SEGREDO = 'segredo-de-teste';
async function pedir(caminho: string, atividade?: number, accept?: string) {
  const headers = new Headers(accept ? { accept } : {});
  if (atividade !== undefined) headers.set('cookie', `${COOKIE_ATIVIDADE}=${await assinarAtividade('s1', atividade, SEGREDO)}`);
  return middleware(new NextRequest(`http://localhost${caminho}`, { headers }));
}

beforeEach(() => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', SEGREDO);
  falso.signOut.mockReset();
  falso.signOut.mockResolvedValue({ error: null });
  falso.rpc.mockReset();
  falso.rpc.mockImplementation(async (nome: string) => (nome === 'situacao_acesso' ? { data: { situacao: 'liberado' }, error: null } : { data: false, error: null }));
});

describe('middleware: limites da sessão', () => {
  it('em uso: segue e renova o cookie de atividade (httpOnly)', async () => {
    falso.login = Date.now() - 2 * H;
    const r = await pedir('/clientes', Date.now() - 10 * 60 * 1000);
    expect(r.headers.get('location')).toBeNull();
    const cookie = r.cookies.get(COOKIE_ATIVIDADE);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.sameSite).toBe('lax');
    expect(falso.signOut).not.toHaveBeenCalled();
  });
  it('mais de 1 h parada: desloga esta sessão e explica', async () => {
    falso.login = Date.now() - 3 * H;
    const r = await pedir('/clientes', Date.now() - H - 60 * 1000);
    expect(r.headers.get('location')).toBe('http://localhost/entrar?erro=sessao');
    expect(falso.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
  it('mais de 12 h desde o login, mesmo em uso: desloga', async () => {
    falso.login = Date.now() - 13 * H;
    const r = await pedir('/clientes', Date.now() - 1000);
    expect(r.headers.get('location')).toBe('http://localhost/entrar?erro=sessao');
  });
  it('sem cookie de atividade e login antigo: desloga (apagar o cookie não estica a sessão)', async () => {
    falso.login = Date.now() - 2 * H;
    const r = await pedir('/clientes');
    expect(r.headers.get('location')).toBe('http://localhost/entrar?erro=sessao');
  });
  it('/api/* chamado por código: 401 em JSON', async () => {
    falso.login = Date.now() - 13 * H;
    const r = await pedir('/api/busca?q=x', Date.now());
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erro: 'sessão expirada' });
  });
});
