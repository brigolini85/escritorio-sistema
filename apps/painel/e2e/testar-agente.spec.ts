import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// "Testar o agente" (spec 2026-09-30 §4 e §5). Nos e2e não roda trabalhador: o teste fica pendente ("Pensando…") e o
// resultado é gravado direto no banco (service role), como o trabalhador gravaria; o Dialog mostra pelo tempo real.

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

const janela = (page: Page) => page.getByRole('dialog', { name: /Testar/ });

test('atendente marcada testa o agente: Pensando…, teste pendente retomado, resultado e erro pelo tempo real', async ({ page }) => {
  const usuario = await criarUsuarioTeste({ email: EMAIL_MARCADA, senha, nome: 'Carla Testa', papel: 'atendente', setores: ['Fiscal'], permissoes: ['treinar_agente'] });
  const { data: cliente } = await db.from('clientes').insert({ razao_social: EMPRESA, nome_fantasia: 'Mercearia Teste', cnpj: CNPJ }).select('id').single();
  await entrar(page, EMAIL_MARCADA, senha);
  await page.goto('/treinar-agente');

  await page.getByRole('button', { name: 'Testar o agente' }).click();
  await expect(janela(page).getByRole('heading', { name: 'Testar o agente' })).toBeVisible();
  await expect(janela(page).getByText('É só um teste: nada é enviado ao cliente nem gravado.')).toBeVisible();

  // Mensagem vazia não sai (campo obrigatório).
  await janela(page).getByRole('button', { name: 'Enviar teste' }).click();
  expect(await simulacoes(usuario)).toHaveLength(0);

  await janela(page).getByLabel('Mensagem do cliente').fill('Bom dia, preciso da guia do DAS.');
  await janela(page).getByRole('combobox', { name: 'Empresa (opcional)' }).click();
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill('Mercearia');
  await page.getByRole('option', { name: /Mercearia Teste/ }).click();
  await janela(page).getByRole('button', { name: 'Enviar teste' }).click();
  await expect(janela(page).getByRole('status').filter({ hasText: 'Pensando…' })).toBeVisible();
  await expect(janela(page).getByRole('button', { name: 'Enviar teste' })).toBeDisabled();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(1);
  const [sim] = await simulacoes(usuario);
  expect(sim).toMatchObject({ mensagem: 'Bom dia, preciso da guia do DAS.', cliente_id: cliente!.id, rascunho: null, status: 'pendente' });

  // Fechar e testar de novo com o primeiro ainda pendente: o Dialog retoma o pendente em vez de criar outro.
  await page.keyboard.press('Escape');
  await expect(janela(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Testar o agente' }).click();
  await janela(page).getByLabel('Mensagem do cliente').fill('Outra mensagem');
  await expect(janela(page).getByRole('combobox', { name: 'Empresa (opcional)' })).toHaveText(/Nenhuma empresa/);
  await janela(page).getByRole('combobox', { name: 'Empresa (opcional)' }).click();
  await page.getByRole('option', { name: /Mercearia Teste/ }).click();
  await janela(page).getByRole('button', { name: 'Enviar teste' }).click();
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
  // As ações ficam recolhidas.
  const acoes = janela(page).getByRole('button', { name: 'O que o agente faria (1)' });
  await expect(acoes).toHaveAttribute('aria-expanded', 'false');
  await expect(janela(page).getByText('Abriria uma demanda no Fiscal: Guia do DAS')).toBeHidden();
  await acoes.click();
  await expect(janela(page).getByText('Abriria uma demanda no Fiscal: Guia do DAS')).toBeVisible();

  // Outro teste, agora sem empresa; o trabalhador grava erro: aviso humano e "Tentar de novo".
  await janela(page).getByRole('button', { name: 'Testar sem empresa' }).click();
  await expect(janela(page).getByRole('combobox', { name: 'Empresa (opcional)' })).toHaveText(/Nenhuma empresa/);
  await janela(page).getByRole('button', { name: 'Enviar teste' }).click();
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

test('"Testar esta orientação" manda o que está no formulário, sem salvar', async ({ page }) => {
  const usuario = await criarUsuarioTeste({ email: EMAIL_ADMIN, senha, nome: 'Dono Testa', papel: 'admin' });
  const { data: cliente } = await db.from('clientes').insert({ razao_social: EMPRESA, nome_fantasia: 'Mercearia Teste', cnpj: CNPJ }).select('id').single();
  const { data: salva } = await db.from('orientacoes_agente')
    .insert({ titulo: 'Prazo do teste', texto: 'Documentos saem no mesmo dia.', tipo: 'regra', ativo: true }).select('id').single();
  await entrar(page, EMAIL_ADMIN, senha);
  await page.goto(`/treinar-agente?orientacao=${salva!.id}`);
  const painel = page.getByRole('dialog', { name: 'Prazo do teste' });

  // Edita sem salvar: texto novo e vale só para a empresa.
  await painel.getByLabel('O que o agente deve fazer').fill('Documentos pedidos até as 15h saem no mesmo dia.');
  await painel.getByRole('radio', { name: 'Uma empresa' }).check();
  await painel.getByRole('combobox', { name: 'Empresa' }).click();
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill('Mercearia');
  await page.getByRole('option', { name: /Mercearia Teste/ }).click();
  await painel.getByRole('button', { name: 'Testar esta orientação' }).click();

  await expect(janela(page).getByRole('heading', { name: 'Testar esta orientação' })).toBeVisible();
  await expect(janela(page).getByText('mesmo sem salvar')).toBeVisible();
  await expect(janela(page).getByText('Orientação em teste:')).toContainText('Prazo do teste');
  // A empresa da orientação já vem escolhida para o teste.
  await expect(janela(page).getByRole('combobox', { name: 'Empresa (opcional)' })).toHaveText(/Mercearia Teste/);
  await janela(page).getByLabel('Mensagem do cliente').fill('Pedi o contrato social às 14h, sai hoje?');
  await janela(page).getByRole('button', { name: 'Enviar teste' }).click();
  await expect(janela(page).getByText('Pensando…')).toBeVisible();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(1);
  expect((await simulacoes(usuario))[0]).toMatchObject({
    mensagem: 'Pedi o contrato social às 14h, sai hoje?',
    cliente_id: cliente!.id,
    rascunho: { id: salva!.id, titulo: 'Prazo do teste', texto: 'Documentos pedidos até as 15h saem no mesmo dia.', tipo: 'regra', cliente_id: cliente!.id, setor_id: null },
  });

  // Nada salvo: a orientação continua como estava e o formulário ainda tem as alterações.
  const { data: depois } = await db.from('orientacoes_agente').select('texto, cliente_id').eq('id', salva!.id).single();
  expect(depois).toEqual({ texto: 'Documentos saem no mesmo dia.', cliente_id: null });
  await page.keyboard.press('Escape');
  await expect(janela(page)).toHaveCount(0);
  await expect(painel.getByText('Alterações não salvas')).toBeVisible();
  await expect(painel.getByLabel('O que o agente deve fazer')).toHaveValue('Documentos pedidos até as 15h saem no mesmo dia.');
});

test('"Testar esta orientação" com o título vazio não abre o teste', async ({ page }) => {
  const usuario = await criarUsuarioTeste({ email: EMAIL_ADMIN, senha, nome: 'Dono Testa', papel: 'admin' });
  await entrar(page, EMAIL_ADMIN, senha);
  await page.goto('/treinar-agente?orientacao=nova');
  const painel = page.getByRole('dialog', { name: 'Nova orientação' });
  await painel.getByLabel('O que o agente deve fazer').fill('Seja breve.');
  await painel.getByRole('button', { name: 'Testar esta orientação' }).click();
  await expect(janela(page)).toHaveCount(0);
  await expect(painel.getByLabel('Título')).toBeFocused();
  expect(await simulacoes(usuario)).toHaveLength(0);
});
