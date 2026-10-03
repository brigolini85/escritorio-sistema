import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C8';
const horaAtras = () => new Date(Date.now() - 3600_000).toISOString();
const pedido = (destinatario: string) => ({
  unidade_id: null, texto_destinatario: destinatario, data: '01/10/2026', data_prevista: null, forma_pagamento: null, valor_frete: null,
  tipo_frete: null, transportadora: null, observacoes: null, entrega: null,
  itens: [{ produto: 'Costela', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 9.5 }],
});

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

test('CSV Bling leva só as demandas de venda do filtro da tela (busca, vencidas, responsável)', async ({ page }) => {
  const eu = await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await demandaE2e({ titulo: `${P} venda vencida minha`, setor: 'Fiscal', status: 'em_andamento', prazoEm: horaAtras(), responsavelId: eu, pedidoVenda: pedido('Mercado Alfa E2E') });
  await demandaE2e({ titulo: `${P} venda no prazo`, setor: 'Fiscal', responsavelId: eu, pedidoVenda: pedido('Mercado Beta E2E') });
  await demandaE2e({ titulo: `${P} venda vencida de ninguém`, setor: 'Fiscal', status: 'em_andamento', prazoEm: horaAtras(), pedidoVenda: pedido('Mercado Gama E2E') });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/demandas?q=${P}&vencidas=1&responsavel=eu`);

  const link = page.getByRole('link', { name: 'CSV Bling' });
  await expect(link).toBeVisible({ timeout: 60_000 });
  const href = (await link.getAttribute('href'))!;
  for (const p of ['vencidas=1', 'responsavel=eu', `q=${P}`]) expect(href).toContain(p);
  const r = await page.request.get(href);
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toContain('text/csv');
  const csv = await r.text();
  expect(csv).toContain('Mercado Alfa E2E');
  expect(csv).not.toContain('Mercado Beta E2E');
  expect(csv).not.toContain('Mercado Gama E2E');
  await expect(page.getByRole('button', { name: 'Imprimir' })).toBeVisible();
});

test('sem pedido de venda no filtro, o CSV não aparece', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await demandaE2e({ titulo: `${P} venda`, setor: 'Fiscal', pedidoVenda: pedido('Mercado Delta E2E') });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/demandas?q=${P}&tipo=outras`);
  await expect(page.getByRole('button', { name: 'Imprimir' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('link', { name: /CSV Bling/ })).toHaveCount(0);
});
