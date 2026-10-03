import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { empresaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C11';

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

async function abrirNova(page: Page) {
  await criarUsuarioTeste({ email: 'ana-c11@e2e.local', senha: SENHA, nome: 'Ana C11', papel: 'atendente', setores: ['Pessoal'] });
  await criarUsuarioTeste({ email: 'bia-c11@e2e.local', senha: SENHA, nome: 'Bia C11', papel: 'atendente', setores: ['Fiscal'] });
  await empresaE2e('Padaria Sol C11', '90000000000441');
  await entrar(page, 'ana-c11@e2e.local', SENHA);
  await page.goto('/demandas');
  await page.getByRole('link', { name: 'Nova demanda' }).click({ timeout: 60_000 });
  const janela = page.getByRole('dialog', { name: 'Nova demanda' });
  await janela.getByRole('combobox', { name: 'Empresa', exact: true }).click({ timeout: 60_000 });
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill('Padaria Sol C11');
  await page.getByRole('option', { name: /Padaria Sol C11/ }).click();
  await janela.getByLabel('Setor').selectOption({ label: 'Pessoal' });
  await janela.getByLabel('Título').fill(`${P} Férias da Joana`);
  await janela.getByLabel('Descrição').fill('Cliente ligou pedindo cálculo de férias a partir de 20/10');
  return janela;
}

test('nova demanda: os quatro rótulos de prioridade aparecem inteiros em 1366x768', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const janela = await abrirNova(page);
  const grupo = await janela.locator('fieldset').boundingBox();
  // folga: o grupo ocupa a linha inteira (mais largo que o campo Prazo ao lado), não só meia coluna
  const prazoCx = await janela.getByLabel('Prazo').boundingBox();
  expect(grupo!.width).toBeGreaterThan(prazoCx!.width * 1.5);
  for (const nome of ['Baixa', 'Normal', 'Alta', 'Urgente']) {
    const opcao = janela.locator('fieldset label').filter({ hasText: new RegExp(`^${nome}$`) });
    await expect(opcao).toBeVisible();
    const cabe = await opcao.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(cabe, `${nome} cortado`).toBe(true);
    const caixa = await opcao.boundingBox();
    expect(caixa!.x + caixa!.width).toBeLessThanOrEqual(grupo!.x + grupo!.width + 1);
  }
});

test('nova demanda: prazo sugerido acompanha a prioridade, responsável só do setor, abre no painel', async ({ page }) => {
  const janela = await abrirNova(page);
  await expect(janela.getByLabel('Responsável').locator('option', { hasText: 'Bia C11' })).toHaveCount(0);
  await janela.getByLabel('Responsável').selectOption({ label: 'Ana C11' });
  const prazo = janela.getByLabel('Prazo');
  const normal = await prazo.inputValue();
  await expect(janela.getByText('sugerido')).toBeVisible();
  await janela.locator('label', { hasText: 'Urgente' }).click();
  await expect(prazo).not.toHaveValue(normal);
  await janela.locator('label', { hasText: 'Alta' }).click();
  await janela.getByRole('button', { name: 'Abrir demanda' }).click();

  await expect(page.getByText(/Demanda #\d+ aberta\./)).toBeVisible();
  await expect(page).toHaveURL(/demanda=/);
  const { data } = await db.from('chamados').select('prioridade, prazo_em, origem, criado_em').eq('titulo', `${P} Férias da Joana`).single();
  expect(data).toMatchObject({ prioridade: 'alta', origem: 'equipe' });
  const { data: sugerido } = await db.rpc('calcular_prazo', { p_prioridade: 'alta', p_inicio: data!.criado_em });
  expect(new Date(data!.prazo_em!).getTime()).toBe(new Date(sugerido as string).getTime());
  await expect(page.getByRole('dialog', { name: /Nº/ })).toContainText(`${P} Férias da Joana`);
  await expect(page.getByRole('dialog', { name: /Nº/ })).toContainText('Ana C11 abriu');
});

test('nova demanda: prazo à mão tira o "sugerido"; erro mostra no campo sem perder o que foi digitado', async ({ page }) => {
  const janela = await abrirNova(page);
  await janela.getByLabel('Título').fill('ab');
  await janela.getByRole('button', { name: 'Abrir demanda' }).click();
  await expect(janela.getByText('O título precisa ter de 3 a 120 caracteres.')).toBeVisible();
  await expect(janela.getByLabel('Descrição')).toHaveValue('Cliente ligou pedindo cálculo de férias a partir de 20/10');
  await janela.getByLabel('Título').fill(`${P} Férias da Joana`);
  await janela.getByLabel('Prazo').fill('2030-01-15T12:00');
  await expect(janela.getByText('sugerido')).toHaveCount(0);
  await janela.getByRole('button', { name: 'Abrir demanda' }).click();
  await expect(page.getByText(/Demanda #\d+ aberta\./)).toBeVisible();
  const { data } = await db.from('chamados').select('prazo_em').eq('titulo', `${P} Férias da Joana`).single();
  expect(new Date(data!.prazo_em!).toISOString()).toBe('2030-01-15T15:00:00.000Z');
});
