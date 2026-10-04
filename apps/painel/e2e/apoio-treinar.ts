import { expect, type Page } from '@playwright/test';

/** Espera o navegador assumir a tela (data-treinar-hidratado). Clicar antes disso perde a ação. */
export async function esperarTreinar(page: Page): Promise<void> {
  await expect(page.locator('[data-treinar-hidratado]')).toHaveCount(1, { timeout: 30_000 });
}

/** Abre Treinar o agente (com ?orientacao=… etc.) e espera a hidratação. */
export async function abrirTreinar(page: Page, consulta = ''): Promise<void> {
  await page.goto(`/treinar-agente${consulta}`);
  await esperarTreinar(page);
}

export const lista = (page: Page) => page.getByRole('region', { name: 'Orientações', exact: true });
export const editor = (page: Page) => page.getByRole('region', { name: 'Editor da orientação', exact: true });
export const simulador = (page: Page) => page.getByRole('region', { name: 'Simulador', exact: true });
