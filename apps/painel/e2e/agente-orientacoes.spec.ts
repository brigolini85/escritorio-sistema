import { expect, test } from '@playwright/test';
import { limparBanco } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA, abrirAgente, criarDono, skillNoBanco } from './apoio-agentes';
import { editor, esperarTreinar, lista, simulador } from './apoio-treinar';

// Parte I1 (spec 7E.1, D12, D16–D18, D20–D22).
test.beforeEach(async () => { await limparBanco(); });

test('/treinar-agente leva à aba Orientações do Thiago, com a mesma tela', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await page.goto('/treinar-agente?orientacao=nova');
  await expect(page).toHaveURL(/\/agentes\/atendimento\/orientacoes\?orientacao=nova$/);
  await esperarTreinar(page);
  await expect(lista(page)).toBeVisible();
  await expect(simulador(page)).toBeVisible();
  await editor(page).getByLabel('Título').fill('Cumprimento');
  await editor(page).getByRole('radio', { name: /Jeito de atender/ }).locator('xpath=..').check();
  await editor(page).getByLabel('O que o agente deve fazer').fill('Chame o cliente pelo primeiro nome.');
  await editor(page).getByRole('button', { name: 'Salvar desligada' }).click();
  await expect(page).toHaveURL(/\/agentes\/atendimento\/orientacoes\?orientacao=[0-9a-f-]{36}$/);
  const { data } = await db.from('orientacoes_agente').select('agente_id').eq('titulo', 'Cumprimento').single();
  expect(data!.agente_id).toBe('a0000000-0000-4000-8000-000000000001');
});

test('orientações do Fiscal: Ana (Fiscal) escreve, sem simulador; Paula (Pessoal) não', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana@agentes.local', senha: SENHA, nome: 'Ana Fiscal', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Fiscal'] });
  await criarUsuarioTeste({ email: 'paula@agentes.local', senha: SENHA, nome: 'Paula Pessoal', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Pessoal'] });
  await entrar(page, 'ana@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal', 'orientacoes?orientacao=nova');
  await esperarTreinar(page);
  await expect(page.getByText('O teste deste agente chega quando ele começar a atender (próxima etapa).')).toBeVisible();
  await editor(page).getByLabel('Título').fill('Prazo');
  await editor(page).getByRole('radio', { name: /Regra do escritório/ }).locator('xpath=..').check();
  await editor(page).getByLabel('O que o agente deve fazer').fill('Notas até as 16h.');
  await editor(page).getByRole('button', { name: 'Salvar desligada' }).click();
  await expect(page).toHaveURL(/\/agentes\/fiscal\/orientacoes\?orientacao=[0-9a-f-]{36}$/);
  const { data, error } = await db.from('orientacoes_agente').select('agentes(slug)').eq('titulo', 'Prazo').single();
  expect(error).toBeNull();
  expect(data!.agentes).toEqual({ slug: 'fiscal' });
  await page.context().clearCookies();
  await entrar(page, 'paula@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal', 'orientacoes');
  await expect(page.getByText('Só quem tem "Treinar o agente" e é do setor Fiscal muda estas orientações.')).toBeVisible();
});

test('Testar com uma skill desligada (dono)', async ({ page }) => {
  await criarDono();
  const id = await skillNoBanco('atendimento', { nome: 'tabela-cfop', tipo: 'conhecimento', titulo: 'Tabela CFOP', corpo: 'Venda: 5102.' });
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento', `testar?skill=${id}`);
  await expect(page.getByText('Testando com a skill')).toContainText('Tabela CFOP (desligada)');
  await expect(simulador(page)).toBeVisible();
});

test('Atividade e custo e "Por agente" em Gastos com IA', async ({ page }) => {
  await criarDono();
  const { data: conversa } = await db.from('conversas').insert({ telefone: '5531966661234' }).select('id').single();
  await db.from('uso_ia').insert({ funcionalidade: 'agente_clientes', agente_id: 'a0000000-0000-4000-8000-000000000001', conversa_id: conversa!.id,
    modelo: 'claude-sonnet-5', tokens_entrada: 1, tokens_saida: 1, custo_usd: 0.25 });
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento', 'atividade');
  await expect(page.getByRole('table', { name: 'Atividade por dia' })).toBeVisible();
  await page.goto('/gastos-ia');
  await expect(page.getByTestId('gastos-agente-atendimento')).toContainText('Thiago');
});
