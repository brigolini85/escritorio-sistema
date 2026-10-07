import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';import { apagarPessoas } from './apoio-sessao';


// Segurança do login (item 6): cabeçalhos de segurança, sem quebrar a tela nem o tempo real.
const SENHA = 'senha-forte-123';

/** Junta as violações de CSP que o navegador registra no console. */
function vigiarCsp(page: Page): string[] {
  const violacoes: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violacoes.push(m.text());
  });
  return violacoes;
}

test.afterAll(async () => { await apagarPessoas(['csp@e2e.local']); });

test('tela de entrada: CSP com nonce, sem moldura, sem farejar tipo, referrer restrito', async ({ page }) => {
  const violacoes = vigiarCsp(page);
  const r = await page.goto('/entrar');
  const h = r!.headers();
  expect(h['content-security-policy']).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['x-frame-options']).toBe('DENY');
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(h['permissions-policy']).toContain('camera=()');
  expect(h['x-powered-by']).toBeUndefined();
  // Fora de produção em https não há HSTS (o navegador guardaria a regra para localhost).
  expect(h['strict-transport-security']).toBeUndefined();
  // A tela funciona (hidratação com o nonce): o link leva à outra tela sem recarregar.
  await page.getByRole('link', { name: 'Esqueci a senha' }).click();
  await expect(page).toHaveURL(/\/esqueci-senha/);
  expect(violacoes).toEqual([]);
});

test('arquivo estático também recebe os cabeçalhos fixos', async ({ page, request }) => {
  await page.goto('/entrar');
  const src = await page.locator('script[src*="/_next/static/"]').first().getAttribute('src');
  const r = await request.get(src!);
  expect(r.ok()).toBe(true);
  expect(r.headers()['x-content-type-options']).toBe('nosniff');
  expect(r.headers()['x-frame-options']).toBe('DENY');
});

test('logado: atendimento abre e o tempo real conecta sem violação de CSP', async ({ page }) => {
  const violacoes = vigiarCsp(page);
  await criarUsuarioTeste({ email: 'csp@e2e.local', senha: SENHA, nome: 'Ana CSP', papel: 'atendente', setores: ['Fiscal'] });
  const sockets: string[] = [];
  page.on('websocket', (ws) => sockets.push(ws.url()));
  await entrar(page, 'csp@e2e.local', SENHA);
  await page.goto('/atendimento');
  await expect.poll(() => sockets.some((u) => u.includes('/realtime/v1/websocket'))).toBe(true);
  expect(violacoes).toEqual([]);
});
