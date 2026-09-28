import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

const CNPJ_EMPRESA = '11444777000161';

async function empresaDeTeste() {
  await db.from('clientes').delete().eq('cnpj', CNPJ_EMPRESA);
  const { data } = await db.from('clientes').insert({ razao_social: 'Indústria Cadastros Teste', cnpj: CNPJ_EMPRESA }).select().single();
  return data!.id as string;
}

test('administrador cadastra rede, unidade com CNPJ e fornecedor', async ({ page }) => {
  const id = await empresaDeTeste();
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}`);
  await page.getByRole('link', { name: 'Clientes da empresa' }).click();
  await page.getByPlaceholder('Nova rede/cliente (ex.: Supermercado Brasil)').fill('Supermercado Brasil');
  await page.getByPlaceholder('Palavras-chave, separadas por vírgula').last().fill('brasil');
  await page.getByRole('button', { name: 'Criar rede' }).click();
  await expect(page.getByLabel('Nome de Supermercado Brasil')).toBeVisible();

  await page.getByPlaceholder('Nome da unidade (ex.: Santa Efigênia)').fill('Santa Efigênia');
  await page.getByPlaceholder('CNPJ').fill('11.222.333/0001-81');
  await page.getByPlaceholder('Bairro').fill('Santa Efigênia');
  await page.getByRole('button', { name: 'Adicionar unidade' }).click();
  await expect(page.getByText('Santa Efigênia · Santa Efigênia · CNPJ 11222333000181')).toBeVisible();

  await page.getByRole('link', { name: 'Fornecedores' }).click();
  await page.getByPlaceholder('Novo fornecedor').fill('Frigorífico Boi Bom');
  await page.getByRole('button', { name: 'Criar fornecedor' }).click();
  await expect(page.getByLabel('Nome de Frigorífico Boi Bom')).toBeVisible();
});

test('atendente sem permissão vê os cadastros mas não edita', async ({ page }) => {
  const id = await empresaDeTeste();
  await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Hortsul' });
  await criarUsuarioTeste({ email: 'ana@teste.com', senha: 'senha-forte-123', nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}?aba=clientes`);
  await expect(page.getByLabel('Nome de Hortsul')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Criar rede' })).toHaveCount(0);
});
test('cadastra produto, define preço para a rede e vê o histórico', async ({ page }) => {
  const id = await empresaDeTeste();
  await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Supermercado Brasil' });
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');

  await page.goto(`/clientes/${id}?aba=produtos`);
  await page.getByPlaceholder('Código').last().fill('12');
  await page.getByPlaceholder('Descrição').last().fill('Costela com Requeijão');
  await page.getByPlaceholder('Unidade (PAC, KG…)').last().fill('PAC');
  await page.getByPlaceholder('Apelidos, separados por vírgula').last().fill('costela');
  await page.getByRole('button', { name: 'Adicionar produto' }).click();
  await expect(page.getByLabel('Descrição de 12')).toHaveValue('Costela com Requeijão');

  await page.getByRole('link', { name: 'Preços' }).click();
  const campo = page.getByLabel('Preço de Costela com Requeijão para Supermercado Brasil');
  await campo.fill('9,50');
  await campo.press('Enter');
  await expect(campo).toHaveValue('9,50');
  await campo.fill('10,00');
  await campo.press('Enter');
  await expect(campo).toHaveValue('10,00');

  await page.getByRole('link', { name: 'histórico' }).first().click();
  await expect(page.getByText('R$ 9,50')).toBeVisible();
  await expect(page.getByText('R$ 10,00 · vigente')).toBeVisible();
});

test('quem não tem Editar preços não vê o campo de preço editável', async ({ page }) => {
  const id = await empresaDeTeste();
  await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Supermercado Brasil' });
  await db.from('produtos').insert({ cliente_id: id, codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC' });
  await criarUsuarioTeste({ email: 'bia@teste.com', senha: 'senha-forte-123', nome: 'Bia', papel: 'atendente', permissoes: ['editar_clientes'] });
  await entrar(page, 'bia@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}?aba=precos`);
  await expect(page.getByLabel('Preço de Costela com Requeijão para Supermercado Brasil')).toBeDisabled();
});
