import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirSecao } from './apoio-configuracoes';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const lerFim = async () => (await db.from('configuracoes').select('horario_fim').eq('id', 1).single()).data!.horario_fim.slice(0, 5);

test.beforeEach(async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-saida@e2e.local', senha: SENHA, nome: 'Admin Saída', papel: 'admin' });
  await entrar(page, 'admin-saida@e2e.local', SENHA);
});

test('sair com alteração: CONTINUAR AQUI, DESCARTAR (também pelo menu do painel) e SALVAR E SAIR', async ({ page }) => {
  const antes = await lerFim();
  const novo = antes === '19:15' ? '18:45' : '19:15';
  try {
    // abrirSecao espera a hidratação: digitar antes dela não dispara os ouvintes do formulário.
    await abrirSecao(page, 'expediente');
    const menu = page.getByRole('navigation', { name: 'Seções das configurações' });
    const fim = page.getByLabel('às', { exact: true });
    await fim.fill(novo, { timeout: 30_000 });
    await expect(menu.getByRole('link', { name: /^Expediente/ })).toContainText('não salvo');

    // Link para a própria seção não pergunta.
    await menu.getByRole('link', { name: /^Expediente/ }).click();
    const janela = page.getByRole('dialog', { name: 'Há alterações não salvas' });
    await expect(janela).toHaveCount(0);

    await menu.getByRole('link', { name: /^Feriados/ }).click();
    await expect(janela).toContainText('Expediente tem 1 alteração não salva.');
    await expect(janela.getByRole('button', { name: 'Continuar aqui' })).toBeFocused();
    await janela.getByRole('button', { name: 'Continuar aqui' }).click();
    await expect(page).toHaveURL(/secao=expediente/);
    await expect(fim).toHaveValue(novo);

    // Menu lateral do painel (outra tela): também pergunta. DESCARTAR volta ao salvo e segue.
    await page.locator('a[href="/demandas"]').first().click();
    await expect(janela).toBeVisible();
    await janela.getByRole('button', { name: 'Descartar' }).click();
    await expect(page).toHaveURL(/\/demandas/);
    expect(await lerFim()).toBe(antes);

    // SALVAR E SAIR grava e segue.
    await abrirSecao(page, 'expediente');
    await page.getByLabel('às', { exact: true }).fill(novo, { timeout: 30_000 });
    await page.getByRole('navigation', { name: 'Seções das configurações' }).getByRole('link', { name: /^Feriados/ }).click();
    await janela.getByRole('button', { name: 'Salvar e sair' }).click();
    await expect(page).toHaveURL(/secao=feriados/);
    expect(await lerFim()).toBe(novo);
  } finally {
    await db.from('configuracoes').update({ horario_fim: `${antes}:00` }).eq('id', 1);
  }
});

test('SALVAR E SAIR com campo inválido fica na seção', async ({ page }) => {
  await abrirSecao(page, 'expediente');
  await page.getByLabel('Das', { exact: true }).fill('19:00', { timeout: 30_000 });
  await page.getByLabel('às', { exact: true }).fill('18:00');
  await page.getByRole('navigation', { name: 'Seções das configurações' }).getByRole('link', { name: /^Feriados/ }).click();
  await page.getByRole('dialog', { name: 'Há alterações não salvas' }).getByRole('button', { name: 'Salvar e sair' }).click();
  await expect(page).toHaveURL(/secao=expediente/);
  await expect(page.getByLabel('Das', { exact: true })).toHaveValue('19:00');
});

test('SALVAR E SAIR em Prazos passa pela janela de impacto (D15)', async ({ page }) => {
  await db.from('configuracoes').update({ prazo_normal_dias: 2 }).eq('id', 1);
  await demandaE2e({ titulo: 'G1 saída aberta', setor: 'Fiscal', prioridade: 'normal', prazoEm: new Date(Date.now() + 40 * 86_400_000).toISOString() });
  try {
    await abrirSecao(page, 'prazos');
    await page.getByLabel('Normal (dias úteis)').fill('3', { timeout: 30_000 });
    await page.getByRole('navigation', { name: 'Seções das configurações' }).getByRole('link', { name: /^Feriados/ }).click();
    await page.getByRole('dialog', { name: 'Há alterações não salvas' }).getByRole('button', { name: 'Salvar e sair' }).click();
    const impacto = page.getByRole('dialog', { name: 'Mudar o prazo das demandas abertas também?' });
    await expect(impacto).toBeVisible({ timeout: 30_000 });
    await impacto.getByRole('button', { name: 'Só para as novas' }).click();
    await expect(page).toHaveURL(/secao=feriados/);
    expect((await db.from('configuracoes').select('prazo_normal_dias').eq('id', 1).single()).data?.prazo_normal_dias).toBe(3);
  } finally {
    await db.from('configuracoes').update({ prazo_normal_dias: 2 }).eq('id', 1);
    await limparDemandasE2e('G1 saída');
  }
});
