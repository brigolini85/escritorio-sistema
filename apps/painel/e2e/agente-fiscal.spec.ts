import { expect, test } from '@playwright/test';
import { configurarAgenteTeste, limparBanco } from '@escritorio/db/teste';
import { db, entrar } from './apoio';
import { SENHA, abrirAgente, criarDono } from './apoio-agentes';

// Parte I2 (spec 7E.3; D2, D8, D11, D14): a ficha do Fiscal quando ele passa a atender.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

test('a faixa acompanha o estado: Teste sem modo avisa; com modo, conta os contatos', async ({ page }) => {
  await criarDono();
  const { data: c } = await db.from('contatos').insert({ nome: 'Carla Teste', telefone: '5531977771111' }).select('id').single();
  await configurarAgenteTeste('fiscal', { estado: 'teste', modo: null, contatos: [c!.id] });
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal');
  await expect(page.getByText('Escolha como fala com o cliente: sem isso o agente não atende.')).toBeVisible();
  await configurarAgenteTeste('fiscal', { modo: 'mesma_voz' });
  await page.reload();
  await expect(page.getByText('Em teste: atende só os contatos da lista (1). Com os outros, o Thiago segue como sempre.')).toBeVisible();
});

test('"Usada no mês" das regras conta conversas', async ({ page }) => {
  await criarDono();
  const fiscal = await configurarAgenteTeste('fiscal', { estado: 'ligado', modo: 'mesma_voz', regras: [{ assunto: 'Pedido de nota de venda', modo: 'mesma_voz' }] });
  const { data: regra } = await db.from('agente_regras_assunto').select('id').eq('agente_id', fiscal).single();
  const conversas: string[] = [];
  for (const t of ['5531977770001', '5531977770002']) conversas.push((await db.from('conversas').insert({ telefone: t }).select('id').single()).data!.id);
  await db.from('decisoes_agente').insert(conversas.map((conversa_id) => ({ conversa_id, etapa: 'chamar_agente', entrada: {},
    saida: { agente_id: fiscal, regra_id: regra!.id, modo: 'mesma_voz' } })));
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal', 'como-fala');
  await expect(page.getByRole('row', { name: /Pedido de nota de venda/ }).getByRole('cell', { name: '2 conversas' })).toBeVisible();
});

test('ferramentas: as "só do Thiago" travadas; as do setor com a aprovação de uma pessoa', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal', 'ferramentas');
  await expect(page.getByLabel(/Abrir demanda/)).toBeDisabled();
  await expect(page.getByRole('listitem').filter({ hasText: 'Nota interna' }).getByText('aprovação de uma pessoa do setor')).toBeVisible();
  await page.getByLabel(/Conferir pedido de nota/).check();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect.poll(async () => (await db.from('agentes').select('ferramentas').eq('slug', 'fiscal').single()).data!.ferramentas).toEqual(['conferir_pedido_nota']);
});
