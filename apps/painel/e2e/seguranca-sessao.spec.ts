import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';
import { atividadeHa } from './apoio-sessao';import { apagarPessoas } from './apoio-sessao';


// Segurança do login (item 7): 1 h sem uso encerra a sessão, com mensagem; o cookie de atividade não é lido pelo JavaScript.
const SENHA = 'senha-forte-123';
const H = 60 * 60 * 1000;

test.afterAll(async () => { await apagarPessoas(['sessao@e2e.local']); });

test('em uso a sessão segue; o cookie de atividade é httpOnly', async ({ page, context, baseURL }) => {
  await criarUsuarioTeste({ email: 'sessao@e2e.local', senha: SENHA, nome: 'Ana Sessão', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'sessao@e2e.local', SENHA);
  await atividadeHa(context, baseURL!, 50 * 60 * 1000);
  await page.goto('/demandas');
  await expect(page).toHaveURL(/\/demandas/);
  const cookie = (await context.cookies()).find((c) => c.name === 'painel_atividade');
  expect(cookie?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('painel_atividade');
});

test('mais de 1 h parada: volta para a entrada com "Sua sessão expirou" e a sessão acabou de verdade', async ({ page, context, baseURL }) => {
  await criarUsuarioTeste({ email: 'sessao@e2e.local', senha: SENHA, nome: 'Ana Sessão', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'sessao@e2e.local', SENHA);
  await atividadeHa(context, baseURL!, H + 5 * 60 * 1000);
  await page.goto('/demandas');
  await page.waitForURL('**/entrar?erro=sessao');
  await expect(page.getByText('Sua sessão expirou. Entre de novo.')).toBeVisible();
  // Sem cookie de sessão: outra página também pede login.
  await page.goto('/clientes');
  await expect(page).toHaveURL(/\/entrar$/);
});
