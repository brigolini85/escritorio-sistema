import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte D: as telas obedecem aos níveis (o banco já recusa; a tela não oferece o que a pessoa não pode).
const SENHA = 'senha-forte-123';
const nivel = (id: string, modulo: string, n: string) => db.from('usuario_permissoes').update({ nivel: n }).eq('usuario_id', id).eq('modulo', modulo);

test('Atendimento "Sem acesso": some do menu e a tela não abre', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-niveis@e2e.local', senha: SENHA, nome: 'Ana Níveis', papel: 'atendente', setores: ['Fiscal'] });
  await nivel(ana, 'atendimento', 'sem_acesso');
  await entrar(page, 'ana-niveis@e2e.local', SENHA);
  await expect(page.getByRole('link', { name: 'Atendimento' })).toHaveCount(0);
  await page.goto('/atendimento');
  await expect(page).toHaveURL(/\/inicio/);
});

test('Clientes "Ver e editar": edita, mas não arquiva', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-niveis@e2e.local', senha: SENHA, nome: 'Ana Níveis', papel: 'atendente', setores: ['Fiscal'] });
  await nivel(ana, 'clientes', 'editar');
  await db.from('clientes').delete().eq('cnpj', '11222333000181');
  await db.from('clientes').insert({ razao_social: 'Níveis Ltda', cnpj: '11222333000181' });
  await entrar(page, 'ana-niveis@e2e.local', SENHA);
  await page.goto('/clientes');
  const linha = page.getByRole('row').filter({ hasText: 'Níveis Ltda' });
  await expect(linha.getByRole('link', { name: 'Editar Níveis Ltda' })).toBeVisible();
  await expect(linha.getByRole('button', { name: /Arquivar ou excluir/ })).toHaveCount(0);
});

test('Configurações "Sim": abre sem teto de IA e sem Usuários; "Sem acesso" volta ao Início', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-niveis@e2e.local', senha: SENHA, nome: 'Ana Níveis', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana-niveis@e2e.local', SENHA);
  await page.goto('/configuracoes');
  await expect(page).toHaveURL(/\/inicio/);
  await nivel(ana, 'configuracoes', 'sim');
  await page.goto('/configuracoes');
  await expect(page.getByRole('heading', { name: 'Expediente', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Teto de IA e alertas' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Integrações' })).toHaveCount(0);
  await page.goto('/usuarios');
  await expect(page).toHaveURL(/\/inicio/);
});

test('sem "Alterar prazos": o prazo da demanda fica travado; com "Sim" libera', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-niveis@e2e.local', senha: SENHA, nome: 'Ana Níveis', papel: 'atendente', setores: ['Fiscal'] });
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: d } = await db.from('chamados').insert({ titulo: 'Prazo travado (e2e)', setor_id: fiscal!.id }).select('id').single();
  await nivel(ana, 'prazos', 'nao');
  await entrar(page, 'ana-niveis@e2e.local', SENHA);
  await page.goto(`/demandas?demanda=${d!.id}`);
  const painel = page.getByRole('dialog', { name: /Nº [0-9]+/ });
  await expect(painel.getByLabel('Prazo', { exact: true })).toBeDisabled({ timeout: 30_000 });
  await expect(painel.getByText('Só quem pode alterar prazos escolhe a data. Mudar a prioridade recalcula o prazo.')).toBeVisible();

  // Com "Sim", o campo libera e a ajuda some.
  await nivel(ana, 'prazos', 'sim');
  await page.reload();
  await expect(painel.getByLabel('Prazo', { exact: true })).toBeEnabled({ timeout: 30_000 });
  await expect(painel.getByText('Só quem pode alterar prazos escolhe a data. Mudar a prioridade recalcula o prazo.')).toHaveCount(0);
});

test('Configurações "Sim": quem não é administrador salva o Expediente, sem Teto de IA nem Integrações', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-niveis@e2e.local', senha: SENHA, nome: 'Ana Níveis', papel: 'atendente', setores: ['Fiscal'] });
  await nivel(ana, 'configuracoes', 'sim');
  const antes = (await db.from('configuracoes').select('horario_fim').eq('id', 1).single()).data!.horario_fim;
  await entrar(page, 'ana-niveis@e2e.local', SENHA);
  await page.goto('/configuracoes');
  await expect(page.getByRole('heading', { name: 'Expediente', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Teto de IA e alertas' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Integrações' })).toHaveCount(0);
  const novoFim = antes.startsWith('19:') ? '18:30' : '19:15';
  try {
    await page.getByLabel('às', { exact: true }).fill(novoFim);
    await page.getByRole('region', { name: 'Expediente' }).getByRole('button', { name: 'Salvar' }).click();
    await expect.poll(async () => (await db.from('configuracoes').select('horario_fim').eq('id', 1).single()).data?.horario_fim.slice(0, 5)).toBe(novoFim);
  } finally {
    await db.from('configuracoes').update({ horario_fim: antes }).eq('id', 1);
  }
});

test('Atendimento "Sem acesso": o painel da demanda não tem o link Abrir conversa', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-niveis@e2e.local', senha: SENHA, nome: 'Ana Níveis', papel: 'atendente', setores: ['Fiscal'] });
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  await db.from('conversas').delete().eq('telefone', '5531999990777');
  const { data: c } = await db.from('conversas').insert({ telefone: '5531999990777' }).select('id').single();
  const { data: d } = await db.from('chamados').insert({ titulo: 'Sem link de conversa (e2e)', setor_id: fiscal!.id, conversa_id: c!.id }).select('id').single();
  await entrar(page, 'ana-niveis@e2e.local', SENHA);
  await page.goto(`/demandas?demanda=${d!.id}`);
  const painel = page.getByRole('dialog', { name: /Nº [0-9]+/ });
  await expect(painel.getByRole('link', { name: 'Abrir conversa' })).toBeVisible({ timeout: 30_000 });
  await nivel(ana, 'atendimento', 'sem_acesso');
  await page.reload();
  await expect(painel.getByRole('heading', { name: 'Linha do tempo' })).toBeVisible({ timeout: 30_000 });
  await expect(painel.getByRole('link', { name: 'Abrir conversa' })).toHaveCount(0);
});

test('Pedidos de nota "Sem acesso": a demanda abre sem o pedido, sem os itens da descrição e sem o antes/depois (P11)', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-niveis@e2e.local', senha: SENHA, nome: 'Ana Níveis', papel: 'atendente', setores: ['Fiscal'] });
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  await db.from('chamados').delete().eq('titulo', 'NF de Mercado Níveis (e2e)');
  const pedido = { unidade_id: null, texto_destinatario: 'Mercado Níveis', data: '04/10/2026', data_prevista: null, forma_pagamento: null, valor_frete: null,
    tipo_frete: null, transportadora: null, observacoes: null, entrega: null, itens: [{ produto: 'Costela', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 9.5 }] };
  const { data: d } = await db.from('chamados')
    .insert({ titulo: 'NF de Mercado Níveis (e2e)', setor_id: fiscal!.id, resumo: '10 PAC Costela a R$ 9,50', pedido_venda: pedido }).select('id').single();
  await db.from('chamado_eventos').insert({ chamado_id: d!.id, tipo: 'nota_interna', texto: 'Pedido alterado pelo assistente.\nAntes:\n10 Costela\nDepois:\n12 Costela' });
  await nivel(ana, 'notas', 'sem_acesso');
  await entrar(page, 'ana-niveis@e2e.local', SENHA);
  await page.goto(`/demandas?demanda=${d!.id}`);
  const painel = page.getByRole('dialog', { name: /Nº [0-9]+/ });
  await expect(painel.getByRole('heading', { name: 'Linha do tempo' })).toBeVisible({ timeout: 30_000 });
  await expect(painel.getByRole('heading', { name: 'Pedido de nota' })).toHaveCount(0);
  await expect(painel.getByText('10 PAC Costela a R$ 9,50')).toHaveCount(0);
  await expect(painel.getByText(/Antes:/)).toHaveCount(0);
  await expect(painel.getByText('Só quem tem acesso a pedidos de nota vê a descrição, os itens e as correções deste pedido.').first()).toBeVisible();

  // Com "Ver", tudo volta como antes.
  await nivel(ana, 'notas', 'ver');
  await page.reload();
  await expect(painel.getByRole('heading', { name: 'Pedido de nota' })).toBeVisible({ timeout: 30_000 });
  await expect(painel.getByText(/Antes:/)).toBeVisible();
});
