import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

test.beforeEach(async () => {
  await db.from('clientes').delete().eq('cnpj', '11222333000181');
  await db.from('contatos').delete().eq('telefone', '5531999990201');
});

test('administrador cadastra cliente e contato autorizado', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto('/clientes/novo');
  await page.getByLabel('Razão social').fill('Indústria X Ltda');
  await page.getByLabel('CNPJ').fill('11.222.333/0001-81');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('heading', { name: 'Indústria X Ltda' })).toBeVisible();

  await page.getByRole('link', { name: 'Contatos', exact: true }).click();
  await page.getByLabel('Nome', { exact: true }).fill('João');
  await page.getByLabel('Telefone').fill('(31) 99999-0201');
  await page.getByLabel('Pode pedir nota').check();
  await page.getByRole('button', { name: 'Adicionar contato' }).click();
  await expect(page.getByText('João · 5531999990201 · pode pedir nota')).toBeVisible();
});

test('atendente sem permissão vê a ficha mas não edita', async ({ page }) => {
  await db.from('clientes').insert({ razao_social: 'Indústria X Ltda', cnpj: '11222333000181' });
  await criarUsuarioTeste({ email: 'ana@teste.com', senha: 'senha-forte-123', nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana@teste.com', 'senha-forte-123');
  await page.goto('/clientes');
  await expect(page.getByRole('link', { name: 'Novo cliente' })).toHaveCount(0);
  await page.getByText('Indústria X Ltda').click();
  await expect(page.getByRole('button', { name: 'Salvar dados' })).toHaveCount(0);
});
