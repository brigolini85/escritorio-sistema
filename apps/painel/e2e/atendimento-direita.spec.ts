import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

const SENHA = 'senha-forte-123';
const TEL = '5531970040001';
const HIDRATADA = 'data-conversa-hidratada';

async function cenario() {
  await db.from('conversas').delete().eq('telefone', TEL);
  await db.from('contatos').delete().eq('telefone', TEL);
  await db.from('clientes').delete().eq('cnpj', '12345678000190');
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: cliente } = await db.from('clientes').insert({ razao_social: 'Rede Bom Preço Ltda', cnpj: '12345678000190', regime: 'Simples Nacional' }).select().single();
  await db.from('servicos').delete().eq('nome', 'Contabilidade mensal direita');
  const { data: servico } = await db.from('servicos').insert({ nome: 'Contabilidade mensal direita' }).select('id, nome').single();
  await db.from('cliente_servicos').insert({ cliente_id: cliente!.id, servico_id: servico!.id });
  const { data: contato } = await db.from('contatos').insert({ nome: 'Carla Direita', telefone: TEL }).select().single();
  await db.from('contato_clientes').insert({ contato_id: contato!.id, cliente_id: cliente!.id, pode_pedir_nota: true, pode_atualizar_preco: false });
  const { data: c } = await db.from('conversas').insert({ telefone: TEL, contato_id: contato!.id, cliente_em_foco: cliente!.id }).select().single();
  const { data: daConversa } = await db.from('chamados')
    .insert({ conversa_id: c!.id, cliente_id: cliente!.id, setor_id: fiscal!.id, titulo: 'Nota de venda direita', prioridade: 'urgente' }).select('id, numero').single();
  const { data: outra } = await db.from('chamados')
    .insert({ cliente_id: cliente!.id, setor_id: fiscal!.id, titulo: 'Alteração de sócio direita', prioridade: 'normal' }).select('id, numero').single();
  const pedido = { unidade_id: null, texto_destinatario: 'Unid. Centro', data: '26/09/2026', data_prevista: null, forma_pagamento: null, valor_frete: null,
    tipo_frete: null, transportadora: null, observacoes: null, entrega: null, itens: [{ produto: 'Costela', sku: '12', un: 'PAC', quantidade: 10, valor_unitario: 9.5 }] };
  await db.from('chamados').insert({ cliente_id: cliente!.id, setor_id: fiscal!.id, titulo: 'NF de Unid. Centro (direita)', pedido_venda: pedido, status: 'concluido', concluido_em: new Date().toISOString() });
  await db.from('documentos_empresa').insert([
    { cliente_id: cliente!.id, nome: 'Cartão CNPJ', arquivo_path: `clientes/${cliente!.id}/cnpj.pdf`, arquivo_nome: 'cnpj.pdf', ia_pode_enviar: true },
    { cliente_id: cliente!.id, nome: 'Balanço interno', arquivo_path: `clientes/${cliente!.id}/balanco.pdf`, arquivo_nome: 'balanco.pdf', ia_pode_enviar: false },
  ]);
  await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: 'oi', processada_em: new Date().toISOString() });
  await db.from('decisoes_agente').insert({ conversa_id: c!.id, etapa: 'consultar_chamados', entrada: {}, saida: { chamados: [] }, turno: '33333333-3333-4333-8333-333333333333' });
  return { conversa: c!.id, daConversa: daConversa!, outra: outra!, servico: servico!.nome };
}

test('aba CLIENTE: empresa, contato, demandas da empresa, pedidos com valor e documentos liberados', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-direita@e2e.local', senha: SENHA, nome: 'Ana Direita', papel: 'atendente', setores: ['Fiscal'] });
  const s = await cenario();
  await entrar(page, 'ana-direita@e2e.local', SENHA);
  await page.goto(`/atendimento/${s.conversa}`);
  const painel = page.locator('#painel-conversa');
  await expect(painel.getByRole('tab', { name: 'Cliente' })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
  await expect(page.locator('body')).toHaveAttribute(HIDRATADA, '', { timeout: 30_000 });
  await expect(painel.getByRole('tab', { name: 'Assistente' })).toHaveCount(0);
  await expect(painel.getByText('12.345.678/0001-90')).toBeVisible();
  await expect(painel.getByText('Simples Nacional')).toBeVisible();
  await expect(painel.getByText(s.servico)).toBeVisible();
  await expect(painel.getByRole('link', { name: /abrir ficha/ })).toHaveAttribute('href', /\/clientes\//);
  await expect(painel.getByText('Pode pedir nota').locator('xpath=following-sibling::dd[1]')).toHaveText('Sim');
  await expect(painel.getByText('Pode mudar preço').locator('xpath=following-sibling::dd[1]')).toHaveText('Não');
  await expect(painel.getByRole('link', { name: new RegExp(`#${s.outra.numero}`) })).toHaveAttribute('href', `/demandas?demanda=${s.outra.id}`);
  // O número aparece no resumo da demanda e, dentro dela (fechada), no título: vale o primeiro.
  await expect(painel.getByText(`#${s.daConversa.numero}`).first()).toBeVisible();
  await expect(painel.getByText('R$ 95,00')).toBeVisible();
  await expect(painel.getByRole('link', { name: 'Cartão CNPJ' })).toHaveAttribute('href', /\/api\/documentos\?id=/);
  await expect(painel.getByText('Balanço interno')).toHaveCount(0);
});

test('demanda desta conversa abre ali, com Concluir; Pedidos de nota "Sem acesso" esconde os pedidos (P11)', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-direita@e2e.local', senha: SENHA, nome: 'Ana Direita', papel: 'atendente', setores: ['Fiscal'] });
  const s = await cenario();
  await db.from('usuario_permissoes').upsert({ usuario_id: ana, modulo: 'notas', nivel: 'sem_acesso' });
  await entrar(page, 'ana-direita@e2e.local', SENHA);
  await page.goto(`/atendimento/${s.conversa}`);
  await expect(page.locator('body')).toHaveAttribute(HIDRATADA, '', { timeout: 30_000 });
  const painel = page.locator('#painel-conversa');
  await expect(painel.getByText('Últimos pedidos de nota')).toHaveCount(0);
  await expect(painel.getByText('R$ 95,00')).toHaveCount(0);
  await painel.getByText(`#${s.daConversa.numero}`).first().click();
  await painel.getByRole('button', { name: `Concluir a demanda #${s.daConversa.numero}` }).click();
  await page.getByRole('dialog', { name: /Concluir a demanda/ }).getByRole('button', { name: 'Concluir' }).click();
  await expect.poll(async () => (await db.from('chamados').select('status').eq('id', s.daConversa.id).single()).data!.status).toBe('concluido');
});

test('aba AGENTE: decisões da conversa; ASSISTENTE só com o assistente', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-direita@e2e.local', senha: SENHA, nome: 'Ana Direita', papel: 'atendente', setores: ['Fiscal'], permissoes: ['assistente_site'] });
  const s = await cenario();
  await entrar(page, 'ana-direita@e2e.local', SENHA);
  await page.goto(`/atendimento/${s.conversa}`);
  await expect(page.locator('body')).toHaveAttribute(HIDRATADA, '', { timeout: 30_000 });
  const painel = page.locator('#painel-conversa');
  await painel.getByRole('tab', { name: 'Agente' }).click();
  await expect(painel.getByText('Consultou as demandas')).toBeVisible({ timeout: 30_000 });
  await painel.getByRole('tab', { name: 'Assistente' }).click();
  await expect(painel.getByText('Já sabe deste cliente')).toBeVisible();
});

// P17: a partir de 1280 px a coluna é própria (não cobre o histórico); em 1100 px o painel fica por cima.
test('de 1280 px o painel não cobre o histórico; em 1100 px cobre', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-direita@e2e.local', senha: SENHA, nome: 'Ana Direita', papel: 'atendente', setores: ['Fiscal'] });
  const s = await cenario();
  await entrar(page, 'ana-direita@e2e.local', SENHA);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/atendimento/${s.conversa}`);
  await expect(page.locator('body')).toHaveAttribute(HIDRATADA, '', { timeout: 30_000 });
  const painel = page.locator('#painel-conversa');
  const log = page.getByRole('log', { name: 'Histórico da conversa' });
  await expect(painel).toBeVisible();
  const [p, l] = [await painel.boundingBox(), await log.boundingBox()];
  expect(l!.x + l!.width).toBeLessThanOrEqual(p!.x + 1);
  await page.setViewportSize({ width: 1100, height: 800 });
  await expect.poll(async () => {
    const [p2, l2] = [await painel.boundingBox(), await log.boundingBox()];
    return l2!.x + l2!.width > p2!.x + 1;
  }).toBe(true);
});

test('demanda da conversa sem empresa em foco aparece na aba CLIENTE e abre ali', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-direita@e2e.local', senha: SENHA, nome: 'Ana Direita', papel: 'atendente', setores: ['Fiscal'] });
  const tel = '5531970040002';
  await db.from('chamados').delete().eq('titulo', 'Triagem sem empresa direita');
  await db.from('conversas').delete().eq('telefone', tel);
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: c } = await db.from('conversas').insert({ telefone: tel }).select().single();
  const { data: d } = await db.from('chamados').insert({ conversa_id: c!.id, setor_id: fiscal!.id, titulo: 'Triagem sem empresa direita' }).select('id, numero').single();
  await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: 'oi', processada_em: new Date().toISOString() });
  await entrar(page, 'ana-direita@e2e.local', SENHA);
  await page.goto(`/atendimento/${c!.id}`);
  await expect(page.locator('body')).toHaveAttribute(HIDRATADA, '', { timeout: 30_000 });
  const painel = page.locator('#painel-conversa');
  await expect(painel.getByText('Nenhuma empresa ligada a esta conversa.')).toBeVisible();
  await painel.getByText(`#${d!.numero}`).first().click();
  await expect(painel.getByRole('button', { name: `Concluir a demanda #${d!.numero}` })).toBeVisible();
  await expect(painel.getByRole('link', { name: `Abrir a demanda #${d!.numero} no painel` })).toHaveAttribute('href', `/demandas?demanda=${d!.id}`);
  await painel.getByRole('button', { name: `Marcar a demanda #${d!.numero} como com o cliente` }).click();
  await expect.poll(async () => (await db.from('chamados').select('status').eq('id', d!.id).single()).data!.status).toBe('aguardando_cliente');
});
