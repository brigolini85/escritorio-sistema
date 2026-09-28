import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Aba Contatos e vínculo de contato já cadastrado pela ficha da empresa (pedido do dono, 2026-09-28).
const TEL_A = '5531999990501';
const TEL_B = '5531999990502';
const CNPJ = '22333444000181';

test.beforeEach(async () => {
  await db.from('contatos').delete().in('telefone', [TEL_A, TEL_B]);
  await db.from('clientes').delete().eq('cnpj', CNPJ);
});

test('aba Contatos lista os cadastrados com empresas e agente, e cadastra contato sem empresa', async ({ page }) => {
  const { data: empresa } = await db.from('clientes').insert({ razao_social: 'Empresa Contatos Teste', cnpj: CNPJ }).select().single();
  const { data: maria } = await db.from('contatos').insert({ nome: 'Maria Contato', telefone: TEL_A, agente_pausado: true }).select().single();
  await db.from('contato_clientes').insert({ contato_id: maria!.id, cliente_id: empresa!.id });
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');

  await page.getByRole('link', { name: 'Contatos', exact: true }).click();
  const linha = page.getByRole('listitem').filter({ hasText: 'Maria Contato' });
  await expect(linha).toContainText(TEL_A);
  await expect(linha).toContainText('Empresa Contatos Teste');
  await expect(linha).toContainText('agente desligado');

  await linha.getByRole('button', { name: 'Ligar o agente' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Maria Contato' }).getByRole('button', { name: 'Desligar o agente' })).toBeVisible();

  await page.getByPlaceholder('Nome', { exact: true }).fill('Zé Sem Empresa');
  await page.getByPlaceholder('Telefone (com DDD)').fill('(31) 99999-0502');
  await page.getByRole('button', { name: 'Cadastrar contato' }).click();
  const ze = page.getByRole('listitem').filter({ hasText: 'Zé Sem Empresa' });
  await expect(ze).toContainText('sem empresa');
});

test('na ficha da empresa, vincula um contato já cadastrado', async ({ page }) => {
  const { data: empresa } = await db.from('clientes').insert({ razao_social: 'Empresa Contatos Teste', cnpj: CNPJ }).select().single();
  const { data: ze } = await db.from('contatos').insert({ nome: 'Zé Sem Empresa', telefone: TEL_B }).select().single();
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');

  await page.goto(`/clientes/${empresa!.id}?aba=contatos`);
  await page.getByLabel('Contato já cadastrado').selectOption({ label: `Zé Sem Empresa · ${TEL_B}` });
  await page.getByLabel('Pode pedir nota (vínculo)').check();
  await page.getByRole('button', { name: 'Vincular contato' }).click();
  await expect(page.getByText(`Zé Sem Empresa · ${TEL_B} · pode pedir nota`)).toBeVisible();
  const { data } = await db.from('contato_clientes').select('pode_pedir_nota').eq('contato_id', ze!.id).eq('cliente_id', empresa!.id).single();
  expect(data).toEqual({ pode_pedir_nota: true });
});
