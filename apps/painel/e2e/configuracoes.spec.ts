import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

test('administrador pausa e retoma o agente pelo Início', async ({ page }) => {
  await db.from('configuracoes').update({ agente_pausado: false }).eq('id', 1);
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.getByRole('button', { name: 'Pausar agente' }).click();
  await expect(page.getByText('O agente está PAUSADO')).toBeVisible();
  expect((await db.from('configuracoes').select('agente_pausado').single()).data?.agente_pausado).toBe(true);
  await page.getByRole('button', { name: 'Retomar agente' }).click();
  await expect(page.getByText('O agente está atendendo normalmente.')).toBeVisible();
});

test('atendente não acessa Configurações', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana@teste.com', senha: 'senha-forte-123', nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana@teste.com', 'senha-forte-123');
  await page.goto('/configuracoes');
  await expect(page).toHaveURL(/\/inicio/);
});

test('administrador cria resposta pronta', async ({ page }) => {
  await db.from('respostas_prontas').delete().eq('pergunta', 'Qual o horário?');
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto('/configuracoes');
  await page.getByPlaceholder('Pergunta (ex.: Qual o horário de atendimento?)').fill('Qual o horário?');
  await page.getByPlaceholder('Resposta', { exact: true }).fill('De segunda a sexta, das 8h às 18h.');
  await page.getByRole('button', { name: 'Adicionar resposta' }).click();
  await expect(page.getByText('De segunda a sexta, das 8h às 18h.')).toBeVisible();
});
