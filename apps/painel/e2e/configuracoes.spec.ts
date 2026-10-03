import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

test('administrador pausa e retoma o agente pelo Início', async ({ page }) => {
  await db.from('configuracoes').update({ agente_pausado: false }).eq('id', 1);
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.getByRole('button', { name: 'Pausar agente' }).click();
  // Pausar e retomar pedem confirmação (ConfirmDialog): o botão da janela envia a mesma action.
  await page.getByRole('dialog').getByRole('button', { name: 'Pausar agente' }).click();
  await expect(page.getByText('O agente está PAUSADO')).toBeVisible();
  expect((await db.from('configuracoes').select('agente_pausado').single()).data?.agente_pausado).toBe(true);
  await page.getByRole('button', { name: 'Retomar agente' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Retomar agente' }).click();
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

test('atendente não acessa Usuários', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana@teste.com', senha: 'senha-forte-123', nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana@teste.com', 'senha-forte-123');
  await page.goto('/usuarios');
  await expect(page).toHaveURL(/\/inicio/);
});

test('administrador convida pessoa na aba Usuários e vê aviso ao faltar telefone', async ({ page }) => {
  const { data: lista } = await db.auth.admin.listUsers();
  const antigo = lista.users.find((u) => u.email === 'nova@teste.com');
  if (antigo) await db.auth.admin.deleteUser(antigo.id);
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.getByRole('button', { name: 'Configurações: abrir submenu' }).click();
  await page.getByRole('menuitem', { name: 'Usuários e permissões' }).click();
  const preencher = async () => {
    // O convite fica numa janela; ela fecha quando o envio dá certo.
    await page.getByRole('button', { name: 'Convidar pessoa' }).click();
    await page.getByPlaceholder('Nome').last().fill('Nova Pessoa');
    await page.getByPlaceholder('E-mail').last().fill('nova@teste.com');
    await page.getByLabel('Usar o assistente pelo WhatsApp (pelo telefone acima)').last().check();
  };
  await preencher();
  await page.getByRole('button', { name: 'Enviar convite' }).click();
  // Sobra 6 da Parte B: a janela fica aberta, com o erro no campo telefone e o que foi digitado.
  const janela = page.getByRole('dialog', { name: 'Convidar pessoa' });
  await expect(janela.getByText('Informe o telefone para usar o assistente pelo WhatsApp')).toBeVisible();
  await expect(janela.getByPlaceholder('E-mail')).toHaveValue('nova@teste.com');
  await janela.getByPlaceholder('Telefone com DDD (para o assistente pelo WhatsApp)').fill('(31) 95555-0001');
  await janela.getByRole('button', { name: 'Enviar convite' }).click();
  await expect(page.getByText('Convite enviado para nova@teste.com.')).toBeVisible();
  await expect(janela).toHaveCount(0);
  await expect(page.getByText('Nova Pessoa · Atendente · assistente no WhatsApp')).toBeVisible();
  const { data } = await db.from('usuarios').select('permissoes, telefone').eq('email', 'nova@teste.com').single();
  expect(data).toEqual({ permissoes: ['assistente_whatsapp'], telefone: '5531955550001' });
  const { data: depois } = await db.auth.admin.listUsers();
  await db.auth.admin.deleteUser(depois.users.find((u) => u.email === 'nova@teste.com')!.id);
});

test('administrador muda o prazo de uma prioridade em Configurações › Prazos', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto('/configuracoes#prazos');
  const secao = page.getByRole('region', { name: 'Prazos por prioridade' });
  await expect(secao).toBeVisible({ timeout: 30_000 });
  await secao.getByLabel('Normal (dias úteis)').fill('3');
  await secao.getByRole('button', { name: 'Salvar prazos' }).click();
  await expect.poll(async () => (await db.from('configuracoes').select('prazo_normal_dias').eq('id', 1).single()).data?.prazo_normal_dias).toBe(3);
  await db.from('configuracoes').update({ prazo_normal_dias: 2 }).eq('id', 1);
});
