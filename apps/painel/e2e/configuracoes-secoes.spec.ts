import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

const SENHA = 'senha-forte-123';

test('menu em grupos com resumos, uma seção por vez e endereço por seção', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-secoes@e2e.local', senha: SENHA, nome: 'Admin Seções', papel: 'admin' });
  await entrar(page, 'admin-secoes@e2e.local', SENHA);
  await page.goto('/configuracoes');
  const menu = page.getByRole('navigation', { name: 'Seções das configurações' });
  for (const g of ['Escritório', 'Agente e atendimento', 'Cadastros', 'Sistema']) {
    await expect(menu.getByRole('heading', { name: g })).toBeVisible({ timeout: 30_000 });
  }
  await expect(menu.getByRole('link', { name: /^Expediente/ })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Configurações · Expediente');
  await expect(page.getByRole('region', { name: 'Feriados' })).toHaveCount(0);
  const { data } = await db.from('configuracoes').select('prazo_alta_dias').eq('id', 1).single();
  await expect(menu.getByRole('link', { name: /^Prazos/ })).toContainText(`alta ${data!.prazo_alta_dias === 0 ? 'mesmo dia' : data!.prazo_alta_dias}`);
  await expect(menu.getByRole('link', { name: /Usuários e permissões/ })).toHaveAttribute('href', '/usuarios');
  await menu.getByRole('link', { name: /^Feriados/ }).click();
  await expect(page).toHaveURL(/\/configuracoes\?secao=feriados$/);
  await expect(page.getByRole('region', { name: 'Feriados' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Expediente' })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Trilha' }).first()).toContainText('Feriados');
});

test('link antigo com âncora abre a seção certa', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-secoes@e2e.local', senha: SENHA, nome: 'Admin Seções', papel: 'admin' });
  await entrar(page, 'admin-secoes@e2e.local', SENHA);
  await page.goto('/configuracoes#teto-ia');
  await expect(page).toHaveURL(/secao=ia/, { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Teto de IA e alertas' })).toBeVisible();
});

test('Configurações "Sim": sem as seções do administrador; pedi-las pela URL abre o Expediente', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-secoes@e2e.local', senha: SENHA, nome: 'Ana Seções', papel: 'atendente', setores: ['Fiscal'] });
  await db.from('usuario_permissoes').update({ nivel: 'sim' }).eq('usuario_id', ana).eq('modulo', 'configuracoes');
  await entrar(page, 'ana-secoes@e2e.local', SENHA);
  await page.goto('/configuracoes?secao=ia');
  await expect(page).toHaveURL(/secao=expediente/, { timeout: 30_000 });
  const menu = page.getByRole('navigation', { name: 'Seções das configurações' });
  await expect(menu.getByRole('link', { name: /^Cargos/ })).toBeVisible();
  for (const nome of [/Teto e modelos de IA/, /Integrações/, /Usuários e permissões/]) await expect(menu.getByRole('link', { name: nome })).toHaveCount(0);
  await expect(menu.getByRole('heading', { name: 'Sistema' })).toHaveCount(0);
});
