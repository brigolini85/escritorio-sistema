import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Revisão geral (painel M9): sessão vencida numa chamada a /api/* responde 401 em JSON (o fetch da tela trata);
// página continua indo para /entrar.
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) }, rpc: async () => ({ data: null, error: null }) }),
}));
import { middleware } from './middleware';

describe('middleware sem sessão', () => {
  it('/api/*: 401 JSON, sem redirecionar', async () => {
    const r = await middleware(new NextRequest('http://localhost/api/busca?q=ana'));
    expect(r.status).toBe(401);
    expect(await r.json()).toEqual({ erro: 'sessão expirada' });
  });
  it('página: vai para /entrar', async () => {
    const r = await middleware(new NextRequest('http://localhost/clientes'));
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('http://localhost/entrar');
  });
});

describe('middleware sem sessão, link de download aberto no navegador', () => {
  it('/api/* pedindo HTML (navegação): vai para /entrar', async () => {
    const r = await middleware(new NextRequest('http://localhost/api/tarefas/csv?id=x', { headers: { accept: 'text/html,application/xhtml+xml' } }));
    expect(r.status).toBe(307);
  });
});

describe('middleware sem sessão, rota de nome parecido com uma pública (item 1)', () => {
  it.each(['/entrar-x', '/esqueci-senha-admin', '/auth/confirm/outra'])('%s vai para /entrar', async (c) => {
    const r = await middleware(new NextRequest(`http://localhost${c}`));
    expect(r.status).toBe(307);
    expect(r.headers.get('location')).toBe('http://localhost/entrar');
  });
  it('/entrar continua aberta', async () => {
    const r = await middleware(new NextRequest('http://localhost/entrar'));
    expect(r.headers.get('location')).toBeNull();
  });
});

describe('cabeçalhos de segurança (item 6)', () => {
  it('página aberta recebe CSP com nonce, e o mesmo nonce vai para o Next no pedido', async () => {
    const r = await middleware(new NextRequest('http://localhost/entrar'));
    const csp = r.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("frame-ancestors 'none'");
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    expect(nonce).toBeTruthy();
    expect(r.headers.get('x-middleware-request-x-nonce')).toBe(nonce);
    expect(r.headers.get('x-middleware-request-content-security-policy')).toBe(csp);
  });
  it('cada pedido tem um nonce novo', async () => {
    const a = (await middleware(new NextRequest('http://localhost/entrar'))).headers.get('content-security-policy');
    const b = (await middleware(new NextRequest('http://localhost/entrar'))).headers.get('content-security-policy');
    expect(a).not.toBe(b);
  });
});
