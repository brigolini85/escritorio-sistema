import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Atalhos do topo do menu (painel v2, Task 7): o estado do WhatsApp é só do administrador.

const senha = 'Senha-e2e-123';
const EMAIL_ADMIN = 'admin-menu@e2e.local';
const EMAIL_ATENDENTE = 'atendente-menu@e2e.local';

test.afterAll(async () => {
  const { data: lista } = await db.auth.admin.listUsers();
  for (const u of lista.users.filter((x) => [EMAIL_ADMIN, EMAIL_ATENDENTE].includes(x.email ?? ''))) await db.auth.admin.deleteUser(u.id);
});

test('atendente vê o atalho do WhatsApp sem estado e sem link', async ({ page }) => {
  await criarUsuarioTeste({ email: EMAIL_ATENDENTE, senha, nome: 'Atendente Menu', papel: 'atendente' });
  await entrar(page, EMAIL_ATENDENTE, senha);
  const menu = page.getByRole('complementary');
  await expect(menu.getByRole('img', { name: 'WhatsApp', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^WhatsApp:/ })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: 'Meu perfil' })).toBeVisible();
  await expect(menu.getByRole('button', { name: 'Sair' })).toBeVisible();
});

test('administrador vê o estado do WhatsApp e a dica do atalho não repete o nome', async ({ page }) => {
  await criarUsuarioTeste({ email: EMAIL_ADMIN, senha, nome: 'Admin Menu', papel: 'admin' });
  await entrar(page, EMAIL_ADMIN, senha);
  const menu = page.getByRole('complementary');
  await expect(menu.getByRole('link', { name: /^WhatsApp: / })).toHaveAttribute('href', '/configuracoes#integracoes');
  await expect(menu.getByRole('img', { name: 'WhatsApp', exact: true })).toHaveCount(0);

  const inicio = menu.locator('a[href="/inicio"][aria-label="Início"]');
  await inicio.hover();
  await expect(page.getByRole('tooltip', { name: 'Início' })).toBeVisible();
  await expect(inicio).not.toHaveAttribute('aria-describedby', /.+/);

  // "Meu perfil" abre o mesmo menu da pessoa.
  await menu.getByRole('button', { name: 'Meu perfil' }).click();
  await expect(page.getByRole('menu').getByText('Admin Menu')).toBeVisible();
});
