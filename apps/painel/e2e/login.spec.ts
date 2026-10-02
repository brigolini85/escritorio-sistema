import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

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

test('aviso do administrador aparece na tela de entrada; vazio não aparece; HTML vira texto', async ({ page }) => {
  await db.from('configuracoes').update({ aviso_login: 'DCTFWeb vence dia 15. <b>Fiscal</b>' }).eq('id', 1);
  await page.goto('/entrar');
  await expect(page.getByText('DCTFWeb vence dia 15. <b>Fiscal</b>')).toBeVisible();
  await db.from('configuracoes').update({ aviso_login: '' }).eq('id', 1);
  await page.goto('/entrar');
  await expect(page.getByTestId('aviso-login')).toHaveCount(0);
});

test('Esqueci a senha leva à tela de pedir nova senha', async ({ page }) => {
  await page.goto('/entrar');
  await page.getByRole('link', { name: 'Esqueci a senha' }).click();
  await expect(page).toHaveURL(/\/esqueci-senha/);
  await page.getByLabel('E-mail').fill('ninguem@teste.com');
  await page.getByRole('button', { name: 'Enviar link' }).click();
  await expect(page.getByText('Se o e-mail estiver cadastrado, o link chega em instantes.')).toBeVisible();
});

test('sem login, qualquer página leva para /entrar', async ({ page }) => {
  await page.goto('/atendimento');
  await expect(page).toHaveURL(/\/entrar/);
});
