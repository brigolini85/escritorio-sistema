import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirTreinar, editor, esperarTreinar } from './apoio-treinar';

// "Testar o agente" (spec 2026-09-30 §4 e §5), desde a G5 no simulador sempre visível da tela (spec 7C.5). Nos e2e não roda
// trabalhador: o teste fica pendente ("Pensando…") e o resultado é gravado direto no banco (service role), como o
// trabalhador gravaria; o simulador mostra pelo tempo real.

const senha = 'Senha-e2e-123';
const EMAIL_MARCADA = 'testa-agente@e2e.local';
const EMAIL_ADMIN = 'admin-testa-agente@e2e.local';
const CNPJ = '45321789000291';
const EMPRESA = 'Mercearia Teste Ltda';

async function limpar() {
  await db.from('orientacoes_agente').delete().eq('titulo', 'Prazo do teste');
  await db.from('clientes').delete().eq('cnpj', CNPJ);
}

test.beforeEach(limpar);
test.afterAll(async () => {
  await limpar();
  // Apagar o login apaga a pessoa em usuarios e as simulações dela (cascata).
  const { data: lista } = await db.auth.admin.listUsers();
  for (const u of lista.users.filter((x) => [EMAIL_MARCADA, EMAIL_ADMIN].includes(x.email ?? ''))) await db.auth.admin.deleteUser(u.id);
});

async function simulacoes(usuarioId: string) {
  const { data } = await db.from('simulacoes_agente').select('id, mensagem, cliente_id, rascunho, status').eq('usuario_id', usuarioId).order('criado_em');
  return data ?? [];
}

const janela = (page: Page) => page.getByRole('region', { name: 'Simulador', exact: true });
const testar = (page: Page) => janela(page).getByRole('button', { name: 'Testar', exact: true });

test('atendente marcada testa o agente: Pensando…, teste pendente retomado, resultado e erro pelo tempo real', async ({ page }) => {
  const usuario = await criarUsuarioTeste({ email: EMAIL_MARCADA, senha, nome: 'Carla Testa', papel: 'atendente', setores: ['Fiscal'], permissoes: ['treinar_agente'] });
  const { data: cliente } = await db.from('clientes').insert({ razao_social: EMPRESA, nome_fantasia: 'Mercearia Teste', cnpj: CNPJ }).select('id').single();
  await entrar(page, EMAIL_MARCADA, senha);
  await abrirTreinar(page);

  await expect(janela(page).getByRole('heading', { name: 'Simulador' })).toBeVisible();
  await expect(janela(page).getByText('Nada é enviado ao cliente nem gravado em demanda.')).toBeVisible();
  await expect(janela(page).getByText('orientações ligadas, sem rascunho')).toBeVisible();

  // Mensagem vazia não sai (campo obrigatório).
  await testar(page).click();
  expect(await simulacoes(usuario)).toHaveLength(0);

  await janela(page).getByLabel('Mensagem do cliente').fill('Bom dia, preciso da guia do DAS.');
  await janela(page).getByRole('combobox', { name: 'Como cliente de' }).click();
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill('Mercearia');
  await page.getByRole('option', { name: /Mercearia Teste/ }).click();
  await testar(page).click();
  await expect(janela(page).getByRole('status').filter({ hasText: 'Pensando…' })).toBeVisible();
  await expect(testar(page)).toBeDisabled();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(1);
  const [sim] = await simulacoes(usuario);
  expect(sim).toMatchObject({ mensagem: 'Bom dia, preciso da guia do DAS.', cliente_id: cliente!.id, rascunho: null, status: 'pendente' });

  // Recarregar e testar de novo com o primeiro ainda pendente: o simulador retoma o pendente em vez de criar outro.
  await page.reload();
  await esperarTreinar(page);
  await janela(page).getByLabel('Mensagem do cliente').fill('Outra mensagem');
  await expect(janela(page).getByRole('combobox', { name: 'Como cliente de' })).toHaveText(/Sem empresa/);
  await janela(page).getByRole('combobox', { name: 'Como cliente de' }).click();
  await page.getByRole('option', { name: /Mercearia Teste/ }).click();
  await testar(page).click();
  await expect(janela(page).getByText('Você já tem um teste em andamento')).toBeVisible();
  await expect(janela(page).getByText('Bom dia, preciso da guia do DAS.')).toBeVisible();
  expect(await simulacoes(usuario)).toHaveLength(1);

  // O trabalhador grava o resultado: aparece sem recarregar.
  await db.from('simulacoes_agente').update({
    status: 'pronta',
    respostas: {
      mensagens: ['Bom dia! Vou pedir a guia ao Fiscal.', 'Assim que estiver pronta, mando aqui.'],
      acoes: [{ ferramenta: 'abrir_chamado', resumo: 'Abriria uma demanda no Fiscal: Guia do DAS' }],
      observacoes: ['1 orientação ficou de fora por passar do limite de caracteres.'],
    },
  }).eq('id', sim!.id);
  await expect(janela(page).getByText('Bom dia! Vou pedir a guia ao Fiscal.')).toBeVisible({ timeout: 10_000 });
  await expect(janela(page).getByText('Assim que estiver pronta, mando aqui.')).toBeVisible();
  await expect(janela(page).getByText('Pensando…')).toHaveCount(0);
  await expect(janela(page).getByText('1 orientação ficou de fora')).toBeVisible();
  // As ações aparecem abertas, em "O que o agente faria"; sem rascunho, não há comparação.
  await expect(janela(page).getByRole('heading', { name: 'O que o agente faria' })).toBeVisible();
  await expect(janela(page).getByText('Abriria uma demanda no Fiscal: Guia do DAS')).toBeVisible();
  await expect(janela(page).getByRole('region', { name: 'Sem o rascunho' })).toHaveCount(0);

  // Outro teste, agora sem empresa; o trabalhador grava erro: aviso humano e "Tentar de novo".
  await janela(page).getByRole('button', { name: 'Testar sem empresa' }).click();
  await expect(janela(page).getByRole('combobox', { name: 'Como cliente de' })).toHaveText(/Sem empresa/);
  await testar(page).click();
  await expect(janela(page).getByText('Pensando…')).toBeVisible();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(2);
  const segunda = (await simulacoes(usuario))[1]!;
  expect(segunda).toMatchObject({ mensagem: 'Outra mensagem', cliente_id: null, status: 'pendente' });
  await db.from('simulacoes_agente').update({ status: 'erro', erro: 'O limite mensal de gasto com IA foi atingido. O teste não pode ser feito agora; fale com o administrador.' }).eq('id', segunda.id);
  await expect(janela(page).getByRole('alert')).toContainText('O limite mensal de gasto com IA foi atingido.', { timeout: 10_000 });
  await janela(page).getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(janela(page).getByText('Pensando…')).toBeVisible();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(3);
  expect((await simulacoes(usuario))[2]).toMatchObject({ mensagem: 'Outra mensagem', cliente_id: null, status: 'pendente' });
  // Nada mais foi gravado: a tela continua sem orientações.
  const { count } = await db.from('orientacoes_agente').select('id', { count: 'exact', head: true }).eq('titulo', 'Prazo do teste');
  expect(count).toBe(0);
});

test('o simulador manda o que está no formulário, sem salvar', async ({ page }) => {
  const usuario = await criarUsuarioTeste({ email: EMAIL_ADMIN, senha, nome: 'Dono Testa', papel: 'admin' });
  const { data: cliente } = await db.from('clientes').insert({ razao_social: EMPRESA, nome_fantasia: 'Mercearia Teste', cnpj: CNPJ }).select('id').single();
  const { data: salva } = await db.from('orientacoes_agente')
    .insert({ titulo: 'Prazo do teste', texto: 'Documentos saem no mesmo dia.', tipo: 'regra', ativo: true }).select('id').single();
  await entrar(page, EMAIL_ADMIN, senha);
  await abrirTreinar(page, `?orientacao=${salva!.id}`);
  const painel = editor(page);

  // Edita sem salvar: texto novo e vale só para a empresa.
  await painel.getByLabel('O que o agente deve fazer').fill('Documentos pedidos até as 15h saem no mesmo dia.');
  // O rádio fica escondido (sr-only) sob o segmento: marca-se pelo rótulo, como a pessoa faz.
  await painel.getByRole('radio', { name: 'Uma empresa' }).locator('xpath=..').check();
  await painel.getByRole('combobox', { name: 'Empresa' }).click();
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill('Mercearia');
  await page.getByRole('option', { name: /Mercearia Teste/ }).click();

  await expect(janela(page).getByText('usando o rascunho, ligado')).toBeVisible();
  // A empresa da orientação já vem escolhida para o teste.
  await expect(janela(page).getByRole('combobox', { name: 'Como cliente de' })).toHaveText(/Mercearia Teste/);
  await janela(page).getByLabel('Mensagem do cliente').fill('Pedi o contrato social às 14h, sai hoje?');
  await testar(page).click();
  await expect(janela(page).getByText('Pensando…')).toBeVisible();
  await expect(janela(page).getByText('Teste com o rascunho')).toContainText('Prazo do teste');
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(1);
  expect((await simulacoes(usuario))[0]).toMatchObject({
    mensagem: 'Pedi o contrato social às 14h, sai hoje?',
    cliente_id: cliente!.id,
    rascunho: { id: salva!.id, titulo: 'Prazo do teste', texto: 'Documentos pedidos até as 15h saem no mesmo dia.', tipo: 'regra', cliente_id: cliente!.id, setor_id: null },
  });

  // Nada salvo: a orientação continua como estava e o formulário ainda tem as alterações.
  const { data: depois } = await db.from('orientacoes_agente').select('texto, cliente_id').eq('id', salva!.id).single();
  expect(depois).toEqual({ texto: 'Documentos saem no mesmo dia.', cliente_id: null });
  await expect(painel.getByText('Rascunho não salvo')).toBeVisible();
  await expect(painel.getByLabel('O que o agente deve fazer')).toHaveValue('Documentos pedidos até as 15h saem no mesmo dia.');
});

test('rascunho com o título vazio não vira teste', async ({ page }) => {
  const usuario = await criarUsuarioTeste({ email: EMAIL_ADMIN, senha, nome: 'Dono Testa', papel: 'admin' });
  await entrar(page, EMAIL_ADMIN, senha);
  await abrirTreinar(page, '?orientacao=nova');
  const painel = editor(page);
  await painel.getByLabel('O que o agente deve fazer').fill('Seja breve.');
  await janela(page).getByLabel('Mensagem do cliente').fill('Oi');
  await testar(page).click();
  await expect(janela(page).getByRole('alert')).toHaveText('Complete o rascunho para testar: Informe o título da orientação.');
  await expect(painel.getByLabel('Título')).toBeFocused();
  expect(await simulacoes(usuario)).toHaveLength(0);
});
