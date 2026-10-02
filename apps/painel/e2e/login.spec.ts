import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';

test('administrador entra e vê o menu completo', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await expect(page.getByRole('button', { name: 'Configurações: abrir submenu' })).toBeVisible();
});

test('senha errada mostra aviso em português', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('admin@teste.com');
  await page.getByLabel('Senha').fill('errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByText('E-mail ou senha incorretos.')).toBeVisible();
});

test('sem login, qualquer página leva para /entrar', async ({ page }) => {
  await page.goto('/atendimento');
  await expect(page).toHaveURL(/\/entrar/);
});
