import { expect, type Page } from '@playwright/test';

/**
 * Abre uma seção de Configurações pelo endereço e espera o React hidratar a página: preencher um campo antes disso junta o
 * digitado ao valor do servidor ("X\nYAuxiliar…"). O menu marca data-hidratado num useEffect (só roda no navegador).
 */
export async function abrirSecao(page: Page, id: string): Promise<void> {
  await page.goto(`/configuracoes?secao=${id}`);
  await expect(page.locator('nav[aria-label="Seções das configurações"][data-hidratado]')).toHaveCount(1, { timeout: 30_000 });
}

/** Salvar prazos: com demanda aberta da prioridade, a janela de impacto abre; escolhe "Só para as novas". */
export async function salvarPrazosSoNovas(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Salvar prazos' }).click();
  const novas = page.getByRole('button', { name: 'Só para as novas' });
  const salvo = page.getByText('Prazos salvos. Valem para as demandas novas.');
  await expect(novas.or(salvo)).toBeVisible({ timeout: 30_000 });
  if (await novas.isVisible()) await novas.click();
  await expect(salvo).toBeVisible();
}

/** "2 dias úteis", "1 dia útil", "mesmo dia (fim do expediente)" (igual a textoDias). */
export const textoDias = (n: number) => (n === 0 ? 'mesmo dia (fim do expediente)' : n === 1 ? '1 dia útil' : `${n} dias úteis`);
