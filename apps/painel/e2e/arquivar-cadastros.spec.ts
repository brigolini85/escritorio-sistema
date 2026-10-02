import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte B do painel v2: produtos, redes e unidades da ficha com Excluir…, Arquivados e Restaurar.
const CNPJ = '18180000000186';
const SENHA = 'senha-forte-123';

test.beforeEach(async () => {
  await db.from('clientes').delete().eq('cnpj', CNPJ);
});

async function semear() {
  const { data: c } = await db.from('clientes').insert({ razao_social: 'Indústria Arquivo', cnpj: CNPJ }).select().single();
  const { data: rede } = await db.from('parceiros_grupos').insert({ cliente_id: c!.id, tipo: 'cliente', nome: 'Rede Arquivo' }).select().single();
  const { data: usada } = await db.from('parceiros_unidades').insert({ cliente_id: c!.id, grupo_id: rede!.id, nome_unidade: 'Unidade Usada' }).select().single();
  const { data: sobra } = await db.from('parceiros_unidades').insert({ cliente_id: c!.id, grupo_id: rede!.id, nome_unidade: 'Unidade Sobra' }).select().single();
  const { data: costela } = await db.from('produtos').insert({ cliente_id: c!.id, codigo: '12', descricao: 'Costela Arquivo', unidade: 'PAC' }).select().single();
  await db.from('precos').insert({ cliente_id: c!.id, grupo_id: rede!.id, produto_id: costela!.id, valor: 9.5 });
  return { cliente: c!.id as string, rede: rede!.id as string, usada: usada!.id as string, sobra: sobra!.id as string, costela: costela!.id as string };
}
async function comoAdmin(page: Page) {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', SENHA);
}

test('arquivar produto com preço: sai da aba Produtos, aparece em Arquivados e volta', async ({ page }) => {
  const s = await semear();
  await comoAdmin(page);
  await page.goto(`/clientes/${s.cliente}?aba=produtos`);
  await page.getByRole('button', { name: 'Arquivar ou excluir Costela Arquivo' }).click();
  const janela = page.getByRole('dialog', { name: 'Arquivar Costela Arquivo?' });
  await expect(janela).toContainText('1 preço fica guardado. Sai das listas e do agente.');
  await janela.getByRole('button', { name: 'Sim, arquivar' }).click();
  await expect(page.getByLabel('Descrição de 12')).toHaveCount(0);

  await page.getByText('Arquivados (1)').click();
  const arquivado = page.getByRole('row').filter({ hasText: 'Costela Arquivo' });
  await expect(arquivado).toContainText('Código 12');
  await arquivado.getByRole('button', { name: 'Restaurar Costela Arquivo' }).click();
  await expect(page.getByLabel('Descrição de 12')).toHaveValue('Costela Arquivo');
});

test('excluir de vez unidade nunca usada e arquivar rede com unidades', async ({ page }) => {
  const s = await semear();
  await comoAdmin(page);
  await page.goto(`/clientes/${s.cliente}?aba=clientes`);
  await page.locator('summary').filter({ hasText: 'Unidade Sobra' }).click();
  await page.getByRole('button', { name: 'Arquivar ou excluir Unidade Sobra' }).click();
  const excluir = page.getByRole('dialog', { name: 'Excluir de vez Unidade Sobra?' });
  await excluir.getByLabel('Digite o nome para confirmar').fill('Unidade Sobra');
  await excluir.getByRole('button', { name: 'Excluir de vez' }).click();
  await expect(page.locator('summary').filter({ hasText: 'Unidade Sobra' })).toHaveCount(0);
  await expect.poll(async () => (await db.from('parceiros_unidades').select('id').eq('id', s.sobra)).data).toEqual([]);

  await page.getByRole('button', { name: 'Arquivar ou excluir Rede Arquivo' }).click();
  const arquivar = page.getByRole('dialog', { name: 'Arquivar Rede Arquivo?' });
  await expect(arquivar).toContainText('1 preço e 1 unidade ficam guardados. Sai das listas e do agente.');
  await arquivar.getByRole('button', { name: 'Sim, arquivar' }).click();
  await expect(page.getByLabel('Nome de Rede Arquivo')).toHaveCount(0);
  await expect.poll(async () => (await db.from('parceiros_grupos').select('ativo').eq('id', s.rede).single()).data!.ativo).toBe(false);
  // Arquivar a rede não mexe nas unidades: restaurar a rede devolve tudo como estava.
  expect((await db.from('parceiros_unidades').select('ativo').eq('id', s.usada).single()).data!.ativo).toBe(true);
});

test('salvar produto e rede sem a caixa Ativo mantém o cadastro ativo', async ({ page }) => {
  const s = await semear();
  await comoAdmin(page);
  await page.goto(`/clientes/${s.cliente}?aba=produtos`);
  await expect(page.getByRole('checkbox', { name: 'Ativo' })).toHaveCount(0);
  await page.getByLabel('Descrição de 12').fill('Costela Nova');
  await page.getByLabel('Descrição de 12').press('Enter');
  await expect.poll(async () => (await db.from('produtos').select('descricao, ativo').eq('id', s.costela).single()).data)
    .toEqual({ descricao: 'Costela Nova', ativo: true });
  await page.goto(`/clientes/${s.cliente}?aba=clientes`);
  await page.getByLabel('Nome de Rede Arquivo').fill('Rede Arquivo Nova');
  await page.getByLabel('Nome de Rede Arquivo').press('Enter');
  await expect.poll(async () => (await db.from('parceiros_grupos').select('nome, ativo').eq('id', s.rede).single()).data)
    .toEqual({ nome: 'Rede Arquivo Nova', ativo: true });
});
