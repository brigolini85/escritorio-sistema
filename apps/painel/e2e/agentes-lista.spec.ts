import { expect, test } from '@playwright/test';
import { limparBanco, marcarDonoTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA, criarDono } from './apoio-agentes';

// Parte I1 (spec 7E.2, D12, D25): tela Agentes.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

test('dono vê os 7 agentes, filtra, busca e cria um agente desligado', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await page.getByRole('link', { name: 'Agentes' }).click();
  // Depois de um lote longo o servidor de desenvolvimento recompila a tela (passava dos 5 s; ficou maior com o Radar, I5).
  await expect(page).toHaveURL(/\/agentes$/, { timeout: 30_000 });
  await expect(page.locator('[data-testid^="agente-"]')).toHaveCount(7);
  // Cada cartão ocupa a coluna inteira da grade (sem cartões de larguras diferentes).
  for (const cartao of await page.locator('[data-testid^="agente-"]').all()) {
    const [c, celula] = await Promise.all([cartao.boundingBox(), cartao.locator('xpath=..').boundingBox()]);
    expect(Math.round(c!.width)).toBe(Math.round(celula!.width));
  }
  const thiago = page.getByTestId('agente-atendimento');
  await expect(thiago).toContainText('Ligado');
  await expect(thiago).toContainText('Direto, é a voz do escritório');
  await expect(page.getByText('Só você altera skills, ferramentas e modo de contato.')).toBeVisible();
  await page.getByRole('link', { name: /Desligados\s*6/ }).click();
  await expect(page.locator('[data-testid^="agente-"]')).toHaveCount(6);
  await page.getByLabel('Buscar agente').fill('legislacao');
  await page.getByLabel('Buscar agente').press('Enter');
  await expect(page.locator('[data-testid^="agente-"]')).toHaveCount(1);
  await page.goto('/agentes');
  await page.getByRole('button', { name: 'Novo agente' }).click();
  await page.getByLabel('Nome').fill('Agente do IRPF');
  await page.getByRole('button', { name: 'Criar agente' }).click();
  await expect(page).toHaveURL(/\/agentes\/agente-do-irpf$/, { timeout: 30_000 });
  const { data } = await db.from('agentes').select('estado, modo_contato, ferramentas').eq('slug', 'agente-do-irpf').single();
  expect(data).toEqual({ estado: 'desligado', modo_contato: null, ferramentas: [] });
});

test('quem treina vê os agentes sem números nem + NOVO AGENTE; sem a marcação, nem o menu', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana@agentes.local', senha: SENHA, nome: 'Ana Treina', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Fiscal'] });
  await criarUsuarioTeste({ email: 'ze@agentes.local', senha: SENHA, nome: 'Zé Sem', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana@agentes.local', SENHA);
  await page.getByRole('link', { name: 'Agentes' }).click();
  await expect(page.locator('[data-testid^="agente-"]')).toHaveCount(7);
  await expect(page.getByRole('button', { name: 'Novo agente' })).toHaveCount(0);
  await expect(page.getByText('Conversas', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Só o dono altera skills, ferramentas e modo de contato.')).toBeVisible();
  await page.context().clearCookies();
  await entrar(page, 'ze@agentes.local', SENHA);
  await expect(page.getByRole('link', { name: 'Agentes' })).toHaveCount(0);
  await page.goto('/agentes');
  await expect(page.getByText('Você não tem acesso a esta tela.')).toBeVisible();
});

test('dono que não é administrador nem treina: o menu mostra Agentes e a tela abre como dono', async ({ page }) => {
  await criarUsuarioTeste({ email: 'bia@agentes.local', senha: SENHA, nome: 'Bia Dona', papel: 'atendente' }).then(marcarDonoTeste);
  await entrar(page, 'bia@agentes.local', SENHA);
  await page.getByRole('link', { name: 'Agentes' }).click();
  // Depois de um lote longo o servidor de desenvolvimento recompila a tela (passava dos 5 s; ficou maior com o Radar, I5).
  await expect(page).toHaveURL(/\/agentes$/, { timeout: 30_000 });
  await expect(page.locator('[data-testid^="agente-"]')).toHaveCount(7);
  await expect(page.getByRole('button', { name: 'Novo agente' })).toBeVisible();
});
