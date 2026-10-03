import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Revisão final do assistente interno (2026-09-29): permissão do CSV, aviso vermelho, rolagem, aba Usuários.
const senha = 'Senha-e2e-123';
const pedido = { unidade_id: null, texto_destinatario: 'Mercado E2E', data: '29/09/2026', data_prevista: null, forma_pagamento: null, valor_frete: null,
  tipo_frete: null, transportadora: null, observacoes: null, entrega: null, itens: [{ produto: 'Costela', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 9.5 }] };

async function demandaDeVenda(titulo: string) {
  await db.from('chamados').delete().eq('titulo', titulo);
  const { data: s } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data, error } = await db.from('chamados').insert({ setor_id: s!.id, titulo, resumo: 'Venda E2E', pedido_venda: pedido }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

test('sem "Corrigir pedidos de nota e gerar CSV do Bling": não vê os botões do CSV e a rota recusa (F)', async ({ page }) => {
  const id = await demandaDeVenda('NF de venda – E2E sem permissão');
  const ana = await criarUsuarioTeste({ email: 'ana-csv@e2e.local', senha, nome: 'Ana', papel: 'atendente', setores: ['Fiscal'], permissoes: ['assistente_site'] });
  await db.from('assistente_mensagens').insert({ usuario_id: ana, canal: 'site', papel: 'assistente', conteudo: 'Arquivo gerado.',
    processada_em: new Date().toISOString(), arquivo: { tipo: 'csv_bling', chamados: [id], nome: 'x.csv', partes: 1 } });
  await entrar(page, 'ana-csv@e2e.local', senha);
  await page.goto('/demandas');
  await expect(page.getByText('NF de venda – E2E sem permissão')).toBeVisible();
  await expect(page.getByRole('link', { name: /CSV Bling/ })).toHaveCount(0);
  await page.goto('/assistente');
  await expect(page.getByText('Arquivo gerado.')).toBeVisible();
  await expect(page.getByRole('link', { name: /CSV Bling/ })).toHaveCount(0);
  for (const url of [`/api/csv-bling?id=${id}`, '/api/csv-bling?setor=todos']) {
    const r = await page.request.get(url);
    expect(r.status()).toBe(403);
    expect(await r.text()).toContain('Você não tem permissão para gerar o CSV do Bling. Peça ao administrador na aba Usuários.');
  }
});

test('com a permissão, a atendente vê o botão e baixa o CSV (F)', async ({ page }) => {
  const id = await demandaDeVenda('NF de venda – E2E com permissão');
  await criarUsuarioTeste({ email: 'ana-csv@e2e.local', senha, nome: 'Ana', papel: 'atendente', setores: ['Fiscal'], permissoes: ['emitir_notas'] });
  await entrar(page, 'ana-csv@e2e.local', senha);
  await page.goto('/demandas');
  await expect(page.getByRole('link', { name: 'Exportar CSV Bling' })).toBeVisible();
  const r = await page.request.get(`/api/csv-bling?id=${id}`);
  expect(r.status()).toBe(200);
  expect(r.headers()['content-type']).toContain('text/csv');
});

test('a conversa com o assistente abre rolada até a mensagem mais nova (J)', async ({ page }) => {
  const dono = await criarUsuarioTeste({ email: 'dono-rolagem@e2e.local', senha, nome: 'Dono', papel: 'admin', permissoes: ['assistente_site'] });
  const agora = Date.now();
  await db.from('assistente_mensagens').insert(Array.from({ length: 40 }, (_, i) => ({
    usuario_id: dono, canal: 'site', papel: i % 2 ? 'assistente' : 'usuario', conteudo: `mensagem ${i}\nsegunda linha\nterceira linha`,
    processada_em: new Date(agora).toISOString(), criado_em: new Date(agora - (40 - i) * 1000).toISOString(),
  })));
  await entrar(page, 'dono-rolagem@e2e.local', senha);
  await page.goto('/assistente');
  await expect(page.getByText('mensagem 39')).toBeVisible();
  const lista = page.getByTestId('mensagens-assistente');
  await expect.poll(() => lista.evaluate((el) => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThan(2);
  expect(await lista.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
});

test('Usuários: telefone inválido avisa; salvar mantém setor inativo, registra quem mudou e tira o aviso vermelho (G, K1, L, M)', async ({ page }) => {
  const admin = await criarUsuarioTeste({ email: 'admin-usuarios@e2e.local', senha, nome: 'Admin E2E', papel: 'admin' });
  await db.from('setores').delete().eq('nome', 'Setor Inativo E2E');
  const { data: inativo } = await db.from('setores').insert({ nome: 'Setor Inativo E2E', ativo: false }).select('id').single();
  const bia = await criarUsuarioTeste({ email: 'bia@e2e.local', senha, nome: 'Bia Revisão', papel: 'atendente' });
  await db.from('usuario_setores').insert({ usuario_id: bia, setor_id: inativo!.id });

  await entrar(page, 'admin-usuarios@e2e.local', senha);
  await page.goto('/usuarios');
  await page.getByText('Bia Revisão · Atendente').click();
  // Clicar na linha abre o painel lateral (?usuario=) com o formulário da pessoa.
  const form = page.getByRole('dialog').locator('form');
  await expect(form.getByLabel('Setor Inativo E2E (inativo)')).toBeChecked();

  await form.getByPlaceholder('Telefone com DDD (para o assistente pelo WhatsApp)').fill('12345');
  await form.getByRole('button', { name: 'Salvar usuário' }).click();
  // Sobra 6 da Parte B: o erro fica no campo, o painel continua aberto e o que foi digitado não se perde.
  await expect(form.getByText('Telefone inválido')).toBeVisible();
  await expect(form.getByPlaceholder('Telefone com DDD (para o assistente pelo WhatsApp)')).toHaveValue('12345');
  await expect(page).not.toHaveURL(/erro=/);

  await form.getByPlaceholder('Nome').fill('Bia Revisão Souza');
  await form.getByPlaceholder('Telefone com DDD (para o assistente pelo WhatsApp)').fill('');
  await form.getByRole('button', { name: 'Salvar usuário' }).click();
  await expect(page.getByText('Bia Revisão Souza · Atendente')).toBeVisible();
  await expect(page.getByText('Telefone inválido')).toHaveCount(0);
  await expect(page).not.toHaveURL(/erro=/);

  const { data: setores } = await db.from('usuario_setores').select('setor_id').eq('usuario_id', bia);
  expect(setores).toEqual([{ setor_id: inativo!.id }]);
  const { data: aud } = await db.from('auditoria_acessos').select('usuario_id').eq('entidade', 'usuarios').eq('entidade_id', bia).eq('acao', 'update');
  expect(aud!.length).toBeGreaterThan(0);
  expect(aud!.every((a) => a.usuario_id === admin)).toBe(true);
  await db.from('usuario_setores').delete().eq('setor_id', inativo!.id);
  await db.from('setores').delete().eq('id', inativo!.id);
});
