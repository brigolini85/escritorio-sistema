import { expect, test } from '@playwright/test';
import { entrar } from './apoio';
import { limparGastos, semearGastos } from './apoio-gastos';

let dados: Awaited<ReturnType<typeof semearGastos>>;
test.beforeAll(async () => { dados = await semearGastos(); });
test.afterAll(async () => { await limparGastos(); });

test('administrador vê o mês: cartões, por funcionalidade e por dia', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.getByRole('link', { name: 'Gastos com IA' }).click();
  await expect(page).toHaveURL(/\/gastos-ia$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gastos com IA');
  await expect(page.getByRole('link', { name: 'Este mês' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('gastos-chamadas')).toContainText('6');
  await expect(page.getByTestId('gastos-audios')).toContainText('2');           // 90 s ≈ 2 min
  await expect(page.getByTestId('gastos-funcionalidade-testar_agente')).toContainText('Testar o agente');
  await expect(page.getByTestId('gastos-funcionalidade-especialista_setor')).toHaveCount(0); // só quando existir
  await expect(page.getByRole('table', { name: 'Gasto por dia' })).toBeAttached();          // alternativa em texto
});

test('Hoje e período inválido', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia?p=hoje');
  await expect(page.getByRole('link', { name: 'Hoje' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('gastos-total')).not.toContainText('Previsão'); // previsão só em "Este mês" (P4)
  await page.goto('/gastos-ia?p=periodo&de=2026-09-24&ate=2026-09-20');
  await expect(page.getByText('Período inválido: mostrando este mês.')).toBeVisible();
});

test('período sem gasto: zeros e estado vazio, sem "NaN"', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia?p=periodo&de=2020-01-01&ate=2020-01-31');
  await expect(page.getByTestId('gastos-por-atendimento')).toContainText('—');
  await expect(page.getByText('Nenhum gasto com IA neste período.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('atendente não vê o item nem a tela', async ({ page }) => {
  await entrar(page, dados.ana.email, dados.ana.senha);
  await expect(page.getByRole('link', { name: 'Gastos com IA' })).toHaveCount(0);
  await page.goto('/gastos-ia');
  await expect(page).toHaveURL(/\/inicio/);
});
