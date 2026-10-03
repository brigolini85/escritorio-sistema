import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte B do painel v2: pessoa arquivada não entra; excluir de vez só quem nunca atendeu, e sai também do login.
const SENHA = 'senha-forte-123';

test.beforeEach(async () => {
  await db.from('chamados').delete().like('titulo', '%(usuario e2e)%');
});

async function tentarEntrar(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
}
const linha = (page: Page, texto: string) => page.getByRole('row').filter({ hasText: texto });

test('arquivar pessoa com demanda aberta: avisa, some da lista, não entra mais e volta ao restaurar', async ({ page }) => {
  const admin = await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin Arquivo', papel: 'admin' });
  const bia = await criarUsuarioTeste({ email: 'bia@teste.com', senha: SENHA, nome: 'Bia Arquivo', papel: 'atendente' });
  const { data: d } = await db.from('chamados').insert({ responsavel_id: bia, titulo: 'Folha de março (usuario e2e)' }).select('numero').single();
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto('/usuarios');
  // Ninguém arquiva o próprio acesso: a linha do administrador não tem o comando.
  await expect(linha(page, 'Admin Arquivo').getByRole('button', { name: /Arquivar ou excluir/ })).toHaveCount(0);
  await linha(page, 'Bia Arquivo').getByRole('button', { name: 'Arquivar ou excluir Bia Arquivo' }).click();
  const janela = page.getByRole('dialog', { name: 'Arquivar Bia Arquivo?' });
  await expect(janela).toContainText('1 demanda fica guardada. Sai das listas e não entra mais no painel.');
  await expect(janela).toContainText(`1 demanda ainda aberta (#${d!.numero})`);
  await janela.getByRole('button', { name: 'Sim, arquivar' }).click();
  await expect(linha(page, 'Bia Arquivo')).toHaveCount(0);
  await expect.poll(async () => (await db.from('usuarios').select('ativo, arquivado_por').eq('id', bia).single()).data)
    .toEqual({ ativo: false, arquivado_por: admin });

  await tentarEntrar(page, 'bia@teste.com');
  await page.waitForURL('**/entrar?erro=inativo');
  await expect(page.getByText('Seu acesso está desativado. Fale com o administrador.')).toBeVisible();
  await page.goto('/inicio');
  await page.waitForURL('**/entrar**');

  await page.context().clearCookies();
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto('/usuarios?ver=arquivados');
  await linha(page, 'Bia Arquivo').getByRole('button', { name: 'Restaurar Bia Arquivo' }).click();
  await expect(linha(page, 'Bia Arquivo')).toHaveCount(0);
  await page.context().clearCookies();
  await entrar(page, 'bia@teste.com', SENHA);
});

test('excluir de vez a pessoa que nunca atendeu tira também o login', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin Arquivo', papel: 'admin' });
  const novo = await criarUsuarioTeste({ email: 'novo@teste.com', senha: SENHA, nome: 'Novo Arquivo', papel: 'atendente' });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto('/usuarios');
  await linha(page, 'Novo Arquivo').getByRole('button', { name: 'Arquivar ou excluir Novo Arquivo' }).click();
  const janela = page.getByRole('dialog', { name: 'Excluir de vez Novo Arquivo?' });
  await expect(janela).toContainText('Nunca atendeu: nenhuma conversa, demanda ou preço. O acesso ao login também é removido. Não dá para desfazer.');
  await janela.getByLabel('Digite o nome para confirmar').fill('Novo Arquivo');
  await janela.getByRole('button', { name: 'Excluir de vez' }).click();
  await expect(linha(page, 'Novo Arquivo')).toHaveCount(0);
  await expect.poll(async () => (await db.from('usuarios').select('id').eq('id', novo)).data).toEqual([]);
  const { data } = await db.auth.admin.getUserById(novo);
  expect(data.user).toBeNull();
});

test('salvar a pessoa sem a chave Ativo não a desativa', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin Arquivo', papel: 'admin' });
  const bia = await criarUsuarioTeste({ email: 'bia@teste.com', senha: SENHA, nome: 'Bia Arquivo', papel: 'atendente' });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/usuarios/${bia}`);
  await expect(page.getByRole('form', { name: 'Cadastro de Bia Arquivo' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('switch', { name: 'Ativo' })).toHaveCount(0);
  await page.getByLabel('Nome', { exact: true }).fill('Bia Arquivo Souza');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect.poll(async () => (await db.from('usuarios').select('nome, ativo').eq('id', bia).single()).data)
    .toEqual({ nome: 'Bia Arquivo Souza', ativo: true });
});

test('lápis de editar em cada linha; na própria linha tem lápis e não tem arquivar', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin Arquivo', papel: 'admin' });
  const bia = await criarUsuarioTeste({ email: 'bia@teste.com', senha: SENHA, nome: 'Bia Arquivo', papel: 'atendente' });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto('/usuarios');
  await expect(linha(page, 'Admin Arquivo').getByRole('link', { name: 'Editar Admin Arquivo' })).toBeVisible();
  await expect(linha(page, 'Admin Arquivo').getByRole('button', { name: /Arquivar ou excluir/ })).toHaveCount(0);
  await linha(page, 'Bia Arquivo').getByRole('link', { name: 'Editar Bia Arquivo' }).click();
  await expect(page).toHaveURL(new RegExp(`/usuarios/${bia}$`));
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Bia Arquivo', { timeout: 30_000 });
});

test('Demandas: pessoa arquivada só aparece no filtro quando já está nele, como "(arquivado)"', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin Arquivo', papel: 'admin' });
  const ze = await criarUsuarioTeste({ email: 'ze@teste.com', senha: SENHA, nome: 'Zé Arquivo', papel: 'atendente' });
  await db.from('chamados').insert({ responsavel_id: ze, titulo: 'Guia do DAS (usuario e2e)' });
  await db.from('usuarios').update({ ativo: false }).eq('id', ze);
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/demandas?responsavel=${ze}`);
  await expect(page.getByRole('link', { name: 'Tirar filtro Responsável: Zé Arquivo (arquivado)' })).toBeVisible();
  await expect(page.getByText(/\(inativo\)/)).toHaveCount(0);
  await page.goto('/demandas');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.getByLabel('Responsável').locator('option', { hasText: 'Zé Arquivo' })).toHaveCount(0);
});
