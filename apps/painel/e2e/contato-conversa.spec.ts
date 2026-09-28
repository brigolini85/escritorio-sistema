import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Cadastrar o contato desconhecido pela própria conversa e ligar/desligar o agente para ele (pedido do dono, 2026-09-28).
const TELEFONE = '5531999990401';
const CNPJ = '22333444000181';

test('cadastra o contato pela conversa, vincula à empresa e desliga o agente para ele', async ({ page }) => {
  await db.from('conversas').delete().eq('telefone', TELEFONE);
  await db.from('contatos').delete().eq('telefone', TELEFONE);
  await db.from('clientes').delete().eq('cnpj', CNPJ);
  const { data: empresa } = await db.from('clientes').insert({ razao_social: 'Empresa Contato Teste', cnpj: CNPJ }).select().single();
  const { data: conversa } = await db.from('conversas').insert({ telefone: TELEFONE }).select().single();
  await db.from('mensagens').insert({ conversa_id: conversa!.id, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'Oi, sou a Maria' });
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');

  await page.goto(`/atendimento/${conversa!.id}`);
  await expect(page.getByText('Contato não cadastrado')).toBeVisible();
  await page.getByLabel('Nome do contato').fill('Maria');
  await page.getByLabel('Empresa (opcional)').selectOption({ label: 'Empresa Contato Teste' });
  await page.getByLabel('Pode pedir nota').check();
  await page.getByLabel('O agente atende este contato').uncheck();
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();

  await expect(page.getByText('Agente desligado para este contato')).toBeVisible();
  const { data: contato } = await db.from('contatos').select('id, nome, agente_pausado').eq('telefone', TELEFONE).single();
  expect(contato).toMatchObject({ nome: 'Maria', agente_pausado: true });
  const { data: vinculo } = await db.from('contato_clientes').select('cliente_id, pode_pedir_nota').eq('contato_id', contato!.id).single();
  expect(vinculo).toEqual({ cliente_id: empresa!.id, pode_pedir_nota: true });
  expect((await db.from('conversas').select('contato_id').eq('id', conversa!.id).single()).data!.contato_id).toBe(contato!.id);

  await page.getByRole('button', { name: 'Ligar o agente para este contato' }).click();
  await expect(page.getByRole('button', { name: 'Desligar o agente para este contato' })).toBeVisible();
  await expect.poll(async () => (await db.from('contatos').select('agente_pausado').eq('id', contato!.id).single()).data!.agente_pausado).toBe(false);
});

test('contato pode ficar sem empresa', async ({ page }) => {
  await db.from('conversas').delete().eq('telefone', TELEFONE);
  await db.from('contatos').delete().eq('telefone', TELEFONE);
  const { data: conversa } = await db.from('conversas').insert({ telefone: TELEFONE }).select().single();
  await db.from('mensagens').insert({ conversa_id: conversa!.id, direcao: 'entrada', autor: 'cliente', tipo: 'texto', conteudo: 'oi' });
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');

  await page.goto(`/atendimento/${conversa!.id}`);
  await page.getByLabel('Nome do contato').fill('Fornecedor Zé');
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  // O rótulo da caixa de marcar tem o mesmo texto: esperar o botão que só existe depois de salvar.
  await expect(page.getByRole('button', { name: 'Desligar o agente para este contato' })).toBeVisible();
  const { data: contato } = await db.from('contatos').select('id, agente_pausado').eq('telefone', TELEFONE).single();
  expect(contato!.agente_pausado).toBe(false);
  expect((await db.from('contato_clientes').select('cliente_id').eq('contato_id', contato!.id)).data).toEqual([]);
});

test('na ficha da empresa, a aba Contatos mostra e troca o agente do contato', async ({ page }) => {
  await db.from('contatos').delete().eq('telefone', TELEFONE);
  await db.from('clientes').delete().eq('cnpj', CNPJ);
  const { data: empresa } = await db.from('clientes').insert({ razao_social: 'Empresa Contato Teste', cnpj: CNPJ }).select().single();
  const { data: contato } = await db.from('contatos').insert({ nome: 'Maria', telefone: TELEFONE, agente_pausado: true }).select().single();
  await db.from('contato_clientes').insert({ contato_id: contato!.id, cliente_id: empresa!.id });
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');

  await page.goto(`/clientes/${empresa!.id}?aba=contatos`);
  await expect(page.getByText('agente desligado')).toBeVisible();
  await page.getByRole('button', { name: 'Ligar o agente' }).click();
  await expect(page.getByRole('button', { name: 'Desligar o agente' })).toBeVisible();
  await expect.poll(async () => (await db.from('contatos').select('agente_pausado').eq('id', contato!.id).single()).data!.agente_pausado).toBe(false);
});
