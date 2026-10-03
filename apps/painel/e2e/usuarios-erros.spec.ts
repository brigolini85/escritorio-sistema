import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Sobras 6 e 4 da Parte B: erro ao salvar em Usuários fica no campo, com o painel aberto e o que foi digitado.
const SENHA = 'senha-forte-123';
const TEL = '5531999991801';
const CAMPO_TEL = 'Telefone com DDD (para o assistente pelo WhatsApp)';

async function cenario() {
  await criarUsuarioTeste({ email: 'admin-erros@e2e.local', senha: SENHA, nome: 'Admin Erros', papel: 'admin' });
  await db.from('usuarios').update({ telefone: null }).eq('telefone', TEL);
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
