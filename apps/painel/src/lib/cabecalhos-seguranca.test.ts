import { describe, expect, it } from 'vitest';
import { CABECALHOS_FIXOS, cabecalhoHsts, gerarNonce, politicaDeConteudo } from './cabecalhos-seguranca';

// Segurança do login (item 6): cabeçalhos de segurança do painel.
const diretivas = (csp: string) => Object.fromEntries(csp.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
  const [nome, ...valores] = d.split(/\s+/);
  return [nome!, valores];
}));

describe('politicaDeConteudo', () => {
  const prod = diretivas(politicaDeConteudo({ nonce: 'abc', supabaseUrl: 'https://xyz.supabase.co', desenvolvimento: false }));

  it('scripts só com o nonce do pedido (sem unsafe-inline nem unsafe-eval em produção)', () => {
    expect(prod['script-src']).toEqual(["'self'", "'nonce-abc'", "'strict-dynamic'"]);
  });
  it('estilos inline permitidos (Next/Radix usam style=), e nada mais de fora', () => {
    expect(prod['style-src']).toEqual(["'self'", "'unsafe-inline'"]);
    expect(prod['font-src']).toEqual(["'self'"]);
  });
  it('Supabase: REST e tempo real (wss) no endereço configurado', () => {
    expect(prod['connect-src']).toEqual(["'self'", 'https://xyz.supabase.co', 'wss://xyz.supabase.co']);
  });
  it('não pode ser aberto dentro de outro site; formulários e base só do próprio painel', () => {
    expect(prod['frame-ancestors']).toEqual(["'none'"]);
    expect(prod['form-action']).toEqual(["'self'"]);
    expect(prod['base-uri']).toEqual(["'self'"]);
    expect(prod['object-src']).toEqual(["'none'"]);
    expect(prod['default-src']).toEqual(["'self'"]);
  });
  it('desenvolvimento: unsafe-eval (recarga do Next) e ws do Supabase local e do próprio servidor', () => {
    const dev = diretivas(politicaDeConteudo({ nonce: 'n', supabaseUrl: 'http://127.0.0.1:54321', desenvolvimento: true }));
    expect(dev['script-src']).toContain("'unsafe-eval'");
    expect(dev['connect-src']).toEqual(["'self'", 'http://127.0.0.1:54321', 'ws://127.0.0.1:54321', 'ws://localhost:*', 'ws://127.0.0.1:*']);
  });
});

describe('cabeçalhos fixos', () => {
  it('X-Frame-Options, Referrer-Policy, nosniff e Permissions-Policy mínima', () => {
    const m = Object.fromEntries(CABECALHOS_FIXOS.map((c) => [c.key, c.value]));
    expect(m['X-Frame-Options']).toBe('DENY');
    expect(m['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(m['X-Content-Type-Options']).toBe('nosniff');
    expect(m['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  });
  it('HSTS só em produção servida por https', () => {
    expect(cabecalhoHsts({ NODE_ENV: 'production', PAINEL_URL: 'https://painel.com' })).toBe('max-age=31536000; includeSubDomains');
    expect(cabecalhoHsts({ NODE_ENV: 'production', PAINEL_URL: 'http://localhost:3002' })).toBeNull();
    expect(cabecalhoHsts({ NODE_ENV: 'development', PAINEL_URL: 'https://painel.com' })).toBeNull();
  });
});

describe('gerarNonce', () => {
  it('aleatório, base64 de 16 bytes', () => {
    const a = gerarNonce();
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
    expect(gerarNonce()).not.toBe(a);
  });
});
