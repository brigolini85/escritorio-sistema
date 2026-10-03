import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Sobras 6 e 4 da Parte B: erro ao salvar em Usuários fica no campo, com o painel aberto e o que foi digitado.
const SENHA = 'senha-forte-123';
const TEL = '5531999991801';
const CAMPO_TEL = 'Telefone com DDD (para o assistente pelo WhatsApp)';

async function cenario() {
  await criarUsuarioTeste({ email: 'admin-erros@e2e.local', senha: SENHA, nome: 'Admin Erros', papel: 'admin' });
  await db.from('usuarios').update({ telefone: null }).in('telefone', [TEL, '5531999991802']);
  const ze = await criarUsuarioTeste({ email: 'ze-erros@e2e.local', senha: SENHA, nome: 'Zé Erros', papel: 'atendente' });
  await db.from('usuarios').update({ telefone: TEL }).eq('id', ze);
  const bia = await criarUsuarioTeste({ email: 'bia-erros@e2e.local', senha: SENHA, nome: 'Bia Erros', papel: 'atendente' });
  return { ze, bia };
}

test('telefone de outra pessoa: o erro aparece no campo, o painel fica aberto e nada se perde', async ({ page }) => {
  const { bia } = await cenario();
  await entrar(page, 'admin-erros@e2e.local', SENHA);
  await page.goto(`/usuarios?usuario=${bia}`);
  const painel = page.getByRole('dialog');
  await painel.getByPlaceholder('Nome').fill('Bia Erros Souza');
  const tel = painel.getByPlaceholder(CAMPO_TEL);
  await tel.fill('(31) 99999-1801');
  await painel.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(painel.getByText('Este telefone já é de Zé Erros.')).toBeVisible();
  await expect(tel).toHaveAttribute('aria-invalid', 'true');
  await expect(tel).toHaveValue('(31) 99999-1801');
  await expect(painel.getByPlaceholder('Nome')).toHaveValue('Bia Erros Souza');
  await expect(painel.getByText('Alterações não salvas')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`usuario=${bia}`));
  await expect(page).not.toHaveURL(/erro=/);
  expect((await db.from('usuarios').select('nome').eq('id', bia).single()).data!.nome).toBe('Bia Erros');
  const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);

  await tel.fill('');
  await painel.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(page.getByText('Salvo: Bia Erros Souza.')).toBeVisible();
  await expect(painel.getByText('Este telefone já é de Zé Erros.')).toHaveCount(0);
  await expect(painel.getByText('Alterações não salvas')).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect.poll(async () => (await db.from('usuarios').select('nome').eq('id', bia).single()).data!.nome).toBe('Bia Erros Souza');
});

test('telefone de pessoa arquivada: diz que está nos arquivados e oferece restaurar ou outro telefone', async ({ page }) => {
  const { ze, bia } = await cenario();
  await db.from('usuarios').update({ ativo: false }).eq('id', ze);
  await entrar(page, 'admin-erros@e2e.local', SENHA);
  await page.goto(`/usuarios?usuario=${bia}`);
  const painel = page.getByRole('dialog');
  const tel = painel.getByPlaceholder(CAMPO_TEL);
  await tel.fill('(31) 99999-1801');
  await painel.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(painel.getByText('Este telefone é de Zé Erros, que está nos arquivados. Restaure Zé Erros ou use outro telefone.')).toBeVisible();

  await painel.getByRole('button', { name: 'Restaurar Zé Erros' }).click();
  await expect(page.getByText('Restaurado: Zé Erros.')).toBeVisible();
  await expect.poll(async () => (await db.from('usuarios').select('ativo').eq('id', ze).single()).data!.ativo).toBe(true);
  await expect(painel.getByText(/que está nos arquivados/)).toHaveCount(0);
  await expect(tel).toHaveValue('(31) 99999-1801');

  // Restaurada, o telefone continua sendo dela: salvar avisa "já é de", e outro telefone resolve.
  await painel.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(painel.getByText('Este telefone já é de Zé Erros.')).toBeVisible();
  await tel.fill('(31) 99999-1802');
  await painel.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(page.getByText('Salvo: Bia Erros.')).toBeVisible();
  await expect.poll(async () => (await db.from('usuarios').select('telefone').eq('id', bia).single()).data!.telefone).toBe('5531999991802');
});
