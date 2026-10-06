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
