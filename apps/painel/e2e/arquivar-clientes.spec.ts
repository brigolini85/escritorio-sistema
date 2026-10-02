import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte B do painel v2: arquivar, excluir de vez e restaurar clientes (spec, seção 5; imagens 01 e 02).
const CNPJ_SOL = '17170000000132';
const CNPJ_DUP = '17170000000213';
const SENHA = 'senha-forte-123';

test.beforeEach(async () => {
  await db.from('chamados').delete().like('titulo', '%(arquivar e2e)%');
  await db.from('clientes').delete().in('cnpj', [CNPJ_SOL, CNPJ_DUP]);
});

async function semearPadaria() {
  const { data: c } = await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: CNPJ_SOL }).select().single();
  const { data: s } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: d } = await db.from('chamados').insert({ cliente_id: c!.id, setor_id: s!.id, titulo: 'Nota de março (arquivar e2e)' }).select('id, numero').single();
  return { id: c!.id, numero: Number(d!.numero) };
}
async function semearNuncaUsado() {
  const { data } = await db.from('clientes').insert({ razao_social: 'Teste Cadastro Duplicado', cnpj: CNPJ_DUP }).select().single();
  return data!.id as string;
}
async function comoAdmin(page: Page) {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', SENHA);
}
const linha = (page: Page, texto: string) => page.getByRole('row').filter({ hasText: texto });

test('arquivar cliente com demanda aberta avisa, some da lista e da busca, e volta ao restaurar', async ({ page }) => {
  const sol = await semearPadaria();
  await comoAdmin(page);
  await page.goto('/clientes');
  await linha(page, 'Padaria Sol ME').getByRole('button', { name: 'Arquivar ou excluir Padaria Sol ME' }).click();
  const janela = page.getByRole('dialog', { name: 'Arquivar Padaria Sol ME?' });
  await expect(janela).toContainText('1 demanda fica guardada. Sai das listas e do agente.');
  await expect(janela).toContainText(`1 demanda ainda aberta (#${sol.numero})`);
  await janela.getByRole('button', { name: 'Sim, arquivar' }).click();

  await expect(linha(page, 'Padaria Sol ME')).toHaveCount(0);
  await expect.poll(async () => (await db.from('clientes').select('ativo').eq('id', sol.id).single()).data!.ativo).toBe(false);
  // Avisa, não bloqueia nem conclui: a demanda continua aberta.
  expect((await db.from('chamados').select('status').eq('numero', sol.numero).single()).data!.status).toBe('aberto');
  const busca = await page.request.get('/api/busca?q=Padaria%20Sol');
  expect((await busca.json()).empresas).toEqual([]);

  await page.getByRole('link', { name: /^Arquivados \(\d+\)$/ }).click();
  const arquivada = linha(page, 'Padaria Sol ME');
  await expect(arquivada).toContainText('Admin');
  await arquivada.getByRole('button', { name: 'Restaurar Padaria Sol ME' }).click();
  await expect(arquivada).toHaveCount(0);
  await expect.poll(async () => (await db.from('clientes').select('ativo, arquivado_em, arquivado_por').eq('id', sol.id).single()).data)
    .toEqual({ ativo: true, arquivado_em: null, arquivado_por: null });
  await page.goto('/clientes');
  await expect(linha(page, 'Padaria Sol ME')).toHaveCount(1);
});

test('administrador exclui de vez o cliente nunca usado, digitando o nome', async ({ page }) => {
  const id = await semearNuncaUsado();
  await comoAdmin(page);
  await page.goto(`/clientes/${id}`);
  await page.getByRole('button', { name: 'Excluir…' }).click();
  const janela = page.getByRole('dialog', { name: 'Excluir de vez Teste Cadastro Duplicado?' });
  await expect(janela).toContainText('Nunca foi usado: nenhuma demanda, conversa, preço ou documento. Não dá para desfazer.');
  const botao = janela.getByRole('button', { name: 'Excluir de vez' });
  await expect(botao).toBeDisabled();
  await janela.getByLabel('Digite o nome para confirmar').fill('Teste Cadastro');
  await expect(botao).toBeDisabled();
  await janela.getByLabel('Digite o nome para confirmar').fill('teste cadastro duplicado');
  await botao.click();
  await page.waitForURL('**/clientes');
  await expect.poll(async () => (await db.from('clientes').select('id').eq('id', id)).data).toEqual([]);
});

test('se o cliente ganha histórico com a janela aberta, o banco recusa e nada é apagado', async ({ page }) => {
  const id = await semearNuncaUsado();
  await comoAdmin(page);
  await page.goto(`/clientes/${id}`);
  await page.getByRole('button', { name: 'Excluir…' }).click();
  const janela = page.getByRole('dialog', { name: 'Excluir de vez Teste Cadastro Duplicado?' });
  await janela.getByLabel('Digite o nome para confirmar').fill('Teste Cadastro Duplicado');
  await db.from('chamados').insert({ cliente_id: id, titulo: 'Chegou agora (arquivar e2e)' });
  await janela.getByRole('button', { name: 'Excluir de vez' }).click();
  await expect(page.getByText('Este cadastro tem histórico e não pode ser excluído de vez. Arquive.')).toBeVisible();
  expect((await db.from('clientes').select('id').eq('id', id)).data).toHaveLength(1);
});

test('atendente sem Editar clientes não vê o comando', async ({ page }) => {
  const id = await semearNuncaUsado();
  await criarUsuarioTeste({ email: 'ana@teste.com', senha: SENHA, nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana@teste.com', SENHA);
  await page.goto('/clientes');
  await expect(linha(page, 'Teste Cadastro Duplicado')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /Arquivar ou excluir/ })).toHaveCount(0);
  await page.goto(`/clientes/${id}`);
  await expect(page.getByRole('button', { name: 'Excluir…' })).toHaveCount(0);
});

test('quem edita clientes, mas não é administrador, arquiva o cliente nunca usado (não exclui de vez)', async ({ page }) => {
  const id = await semearNuncaUsado();
  await criarUsuarioTeste({ email: 'bia@teste.com', senha: SENHA, nome: 'Bia', papel: 'atendente', permissoes: ['editar_clientes'] });
  await entrar(page, 'bia@teste.com', SENHA);
  await page.goto('/clientes');
  await linha(page, 'Teste Cadastro Duplicado').getByRole('button', { name: 'Arquivar ou excluir Teste Cadastro Duplicado' }).click();
  const janela = page.getByRole('dialog', { name: 'Arquivar Teste Cadastro Duplicado?' });
  await expect(janela).toContainText('Nunca foi usado. Sai das listas e do agente.');
  await expect(janela.getByRole('textbox')).toHaveCount(0);
  await janela.getByRole('button', { name: 'Sim, arquivar' }).click();
  await expect.poll(async () => (await db.from('clientes').select('ativo').eq('id', id).single()).data!.ativo).toBe(false);
});

test('cadastrar o CNPJ de um cliente arquivado aponta para os arquivados', async ({ page }) => {
  await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: CNPJ_SOL, ativo: false });
  await comoAdmin(page);
  await page.goto('/clientes/novo');
  await page.getByLabel('Razão social').fill('Padaria Sol Nova');
  await page.getByLabel('CNPJ').fill('17.170.000/0001-32');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Este CNPJ é de um cliente arquivado. Restaure em Clientes › Arquivados.')).toBeVisible();
});
