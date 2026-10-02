import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';

const tamanho = (page: import('@playwright/test').Page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).fontSize);

test.describe('letra que acompanha a tela (spec 4.2)', () => {
  test.beforeEach(async () => {
    await criarUsuarioTeste({ email: 'letra@teste.com', senha: 'senha-forte-123', nome: 'Letra Teste', papel: 'atendente' });
  });

  test('14px em 1366, 16px em 1920 e 2560; o menu cresce junto', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await entrar(page, 'letra@teste.com', 'senha-forte-123');
    expect(await tamanho(page)).toBe('14px');
    const menu1366 = (await page.locator('aside').boundingBox())!.width;
    await page.setViewportSize({ width: 1920, height: 1080 });
    expect(await tamanho(page)).toBe('16px');
    // O menu anima a largura (150ms): espera assentar antes de comparar.
    await expect.poll(async () => (await page.locator('aside').boundingBox())!.width / menu1366, { timeout: 5000 }).toBeCloseTo(16 / 14, 1);
    await page.setViewportSize({ width: 2560, height: 1440 });
    expect(await tamanho(page)).toBe('16px');
  });

  test('Tamanho da letra Grande soma 1px, fica depois de recarregar e volta no próximo login', async ({ page, context }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await entrar(page, 'letra@teste.com', 'senha-forte-123');
    await page.getByRole('button', { name: 'Menu do usuário' }).click();
    // Espera a gravação no perfil terminar: recarregar antes disso volta a letra do perfil antigo.
    const salvou = page.waitForResponse((r) => r.request().method() === 'POST' && !!r.request().headers()['next-action']);
    await page.getByRole('menuitemradio', { name: 'Grande' }).click();
    await salvou;
    expect(await tamanho(page)).toBe('15px');
    await page.reload();
    expect(await tamanho(page)).toBe('15px');
    await context.clearCookies();
    await entrar(page, 'letra@teste.com', 'senha-forte-123');
    expect(await tamanho(page)).toBe('15px');
  });

  test('cookie de letra estranho vira normal', async ({ page, context }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await context.addCookies([{ name: 'tamanho_letra', value: 'xyz', url: `http://localhost:${process.env.E2E_PORTA ?? '3100'}` }]);
    await page.goto('/entrar');
    expect(await tamanho(page)).toBe('14px');
  });
});

test('item ativo do menu: faixa vinho e nome acessível igual ao de antes', async ({ page }) => {
  await criarUsuarioTeste({ email: 'menu@teste.com', senha: 'senha-forte-123', nome: 'Menu Teste', papel: 'admin' });
  await page.setViewportSize({ width: 1366, height: 768 });
  await entrar(page, 'menu@teste.com', 'senha-forte-123');
  await page.goto('/clientes');
  await expect(page.getByRole('link', { name: 'Clientes', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('navigation', { name: 'Trilha' })).toContainText('Cadastros');
  await expect(page.getByRole('link', { name: 'Início' }).first()).toBeVisible();
});
