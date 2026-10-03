import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C13';

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

/** Fim do dia de hoje em Brasília (UTC-3, sem horário de verão) menos 1 minuto: ainda hoje e no futuro. */
// A atrasada vence ontem (26 h atrás): uma de 1 h atrás também cairia em "hoje" e contaria nos dois números.
function fimDeHoje(): string {
  const UM_DIA = 24 * 3600_000;
  const inicio = Math.floor((Date.now() - 3 * 3600_000) / UM_DIA) * UM_DIA + 3 * 3600_000;
  return new Date(inicio + UM_DIA - 60_000).toISOString();
}

/** O número grande do cartão do Início (outras demandas do banco também contam, por isso a comparação é por diferença). */
async function numero(page: Page, titulo: string): Promise<number> {
  const cartao = page.locator('div', { has: page.locator('p', { hasText: new RegExp(`^${titulo}$`) }) }).last();
  return Number((await cartao.locator('p').nth(1).innerText()).trim());
}

test('Início: Vencem hoje e Vencidas contam e levam à tabela com o filtro', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', SENHA);
  await expect(page.getByText('Vencem hoje', { exact: true })).toBeVisible({ timeout: 30_000 });
  const antesHoje = await numero(page, 'Vencem hoje');
  const antesVencidas = await numero(page, 'Vencidas');

  await demandaE2e({ titulo: `${P} Vence hoje`, setor: 'Fiscal', status: 'em_andamento', prazoEm: fimDeHoje() });
  await demandaE2e({ titulo: `${P} Atrasada`, setor: 'Fiscal', status: 'em_andamento', prazoEm: new Date(Date.now() - 26 * 3600_000).toISOString() });
  await page.goto('/inicio');
  await expect.poll(() => numero(page, 'Vencem hoje')).toBe(antesHoje + 1);
  await expect.poll(() => numero(page, 'Vencidas')).toBe(antesVencidas + 1);

  const cartao = (titulo: string) => page.locator('div', { has: page.locator('p', { hasText: new RegExp(`^${titulo}$`) }) }).last();
  await cartao('Vencem hoje').getByRole('link', { name: 'Ver na lista' }).click();
  await expect(page).toHaveURL(/prazo=hoje/);
  await expect(page.getByText('Prazo: vence hoje')).toBeVisible({ timeout: 30_000 });
  // A tabela pode ter outras demandas do banco: a busca deixa só as deste teste.
  await page.goto(`/demandas?prazo=hoje&q=${P}`);
  await expect(page.getByRole('row', { name: new RegExp(`${P} Vence hoje`) })).toBeVisible();

  await page.goto('/inicio');
  await cartao('Vencidas').getByRole('link', { name: 'Ver na lista' }).click();
  await expect(page).toHaveURL(/vencidas=1/);
  await expect(page.getByRole('navigation', { name: 'Filtros rápidos' }).getByRole('link', { name: /Vencidas/ })).toHaveAttribute('aria-current', 'true', { timeout: 30_000 });
  await page.goto(`/demandas?vencidas=1&q=${P}`);
  await expect(page.getByRole('row', { name: new RegExp(`${P} Atrasada`) })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`${P} Vence hoje`) })).toHaveCount(0);
});
