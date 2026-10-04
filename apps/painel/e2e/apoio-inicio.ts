import { expect, type Page } from '@playwright/test';

/**
 * Abre o Início e espera o navegador assumir a página: o "atualizado há…" marca data-hidratado num useEffect (só roda
 * no navegador). Clicar antes disso perde o clique (mesmo cuidado do abrirSecao da G1).
 */
export async function abrirInicio(page: Page, versao: 'situacao' | 'mesa'): Promise<void> {
  await page.goto('/inicio');
  await expect(page.locator(`[data-inicio="${versao}"] [data-atualizado][data-hidratado]`)).toHaveCount(1, { timeout: 30_000 });
}

export const cartaoNumero = (page: Page, chave: string) => page.locator(`[data-numero="${chave}"]`);

/** O número grande de um cartão do Início (contrato: data-numero/data-valor, D20). */
export async function numeroInicio(page: Page, chave: string): Promise<number> {
  return Number((await cartaoNumero(page, chave).locator('[data-valor]').innerText()).trim());
}
