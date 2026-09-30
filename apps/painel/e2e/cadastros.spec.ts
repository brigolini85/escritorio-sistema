import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

const CNPJ_EMPRESA = '11444777000161';

async function empresaDeTeste() {
  await db.from('clientes').delete().eq('cnpj', CNPJ_EMPRESA);
  const { data } = await db.from('clientes').insert({ razao_social: 'Indústria Cadastros Teste', cnpj: CNPJ_EMPRESA }).select().single();
  return data!.id as string;
}

test('administrador cadastra rede, unidade com CNPJ e fornecedor', async ({ page }) => {
  const id = await empresaDeTeste();
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}`);
  await page.getByRole('link', { name: 'Clientes e fornecedores' }).click();
  await page.getByPlaceholder('Nova rede/cliente (ex.: Supermercado Brasil)').fill('Supermercado Brasil');
  await page.getByPlaceholder('Palavras-chave, separadas por vírgula').last().fill('brasil');
  await page.getByRole('button', { name: 'Criar rede' }).click();
  await expect(page.getByLabel('Nome de Supermercado Brasil')).toBeVisible();

  await page.getByPlaceholder('Nome da unidade (ex.: Santa Efigênia)').fill('Santa Efigênia');
  await page.getByPlaceholder('CNPJ').fill('11.222.333/0001-81');
  await page.getByPlaceholder('Bairro').fill('Santa Efigênia');
  await page.getByRole('button', { name: 'Adicionar unidade' }).click();
  await expect(page.getByText('Santa Efigênia · Santa Efigênia · CNPJ 11222333000181')).toBeVisible();

  await page.getByRole('link', { name: 'Fornecedores', exact: true }).click();
  await page.getByPlaceholder('Novo fornecedor').fill('Frigorífico Boi Bom');
  await page.getByRole('button', { name: 'Criar fornecedor' }).click();
  await expect(page.getByLabel('Nome de Frigorífico Boi Bom')).toBeVisible();
});

test('atendente sem permissão vê os cadastros mas não edita', async ({ page }) => {
  const id = await empresaDeTeste();
  await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Hortsul' });
  await criarUsuarioTeste({ email: 'ana@teste.com', senha: 'senha-forte-123', nome: 'Ana', papel: 'atendente' });
  await entrar(page, 'ana@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}?aba=clientes`);
  await expect(page.getByLabel('Nome de Hortsul')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Criar rede' })).toHaveCount(0);
});
test('cadastra produto, define preço para a rede e vê o histórico', async ({ page }) => {
  const id = await empresaDeTeste();
  await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Supermercado Brasil' });
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');

  await page.goto(`/clientes/${id}?aba=produtos`);
  await page.getByPlaceholder('Código').last().fill('12');
  await page.getByPlaceholder('Descrição').last().fill('Costela com Requeijão');
  await page.getByPlaceholder('Unidade (PAC, KG…)').last().fill('PAC');
  await page.getByPlaceholder('Apelidos, separados por vírgula').last().fill('costela');
  await page.getByRole('button', { name: 'Adicionar produto' }).click();
  await expect(page.getByLabel('Descrição de 12')).toHaveValue('Costela com Requeijão');

  await page.getByRole('link', { name: 'Preços' }).click();
  const campo = page.getByLabel('Preço de Costela com Requeijão para Supermercado Brasil', { exact: true });
  await campo.fill('9,50');
  await campo.press('Enter');
  await expect(campo).toHaveValue('9,50');
  await campo.fill('10,00');
  await campo.press('Enter');
  await expect(campo).toHaveValue('10,00');

  await page.getByRole('link', { name: 'histórico' }).first().click();
  await expect(page.getByText('R$ 9,50')).toBeVisible();
  await expect(page.getByText('R$ 10,00 · vigente')).toBeVisible();
});

test('quem não tem Editar preços não vê o campo de preço editável', async ({ page }) => {
  const id = await empresaDeTeste();
  await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Supermercado Brasil' });
  await db.from('produtos').insert({ cliente_id: id, codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC' });
  await criarUsuarioTeste({ email: 'bia@teste.com', senha: 'senha-forte-123', nome: 'Bia', papel: 'atendente', permissoes: ['editar_clientes'] });
  await entrar(page, 'bia@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}?aba=precos`);
  await expect(page.getByLabel('Preço de Costela com Requeijão para Supermercado Brasil', { exact: true })).toBeDisabled();
});
test('envia documento, libera para a IA e baixa', async ({ page }) => {
  const id = await empresaDeTeste();
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}?aba=documentos`);
  await page.getByPlaceholder('Nome do documento (ex.: Contrato social)').fill('Contrato social');
  await page.locator('input[name="arquivo"]').setInputFiles({ name: 'contrato.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 teste') });
  await page.getByRole('button', { name: 'Enviar documento' }).click();
  await expect(page.getByText('Contrato social · contrato.pdf')).toBeVisible();
  await expect(page.getByText('só a equipe envia')).toBeVisible();

  await page.getByRole('button', { name: 'Liberar para a IA' }).click();
  // A frase também está no texto explicativo da tela: esperar o botão mudar, que só acontece depois de salvar.
  await expect(page.getByRole('button', { name: 'Bloquear para a IA' })).toBeVisible();
  const { data } = await db.from('documentos_empresa').select('ia_pode_enviar').eq('cliente_id', id).single();
  expect(data!.ia_pode_enviar).toBe(true);

  // O Chromium de teste baixa o PDF em vez de abrir a aba; confere a rota: redireciona para o link assinado e audita.
  const { data: doc } = await db.from('documentos_empresa').select('id').eq('cliente_id', id).single();
  await expect(page.getByRole('link', { name: 'Baixar' })).toHaveAttribute('href', `/api/documentos?id=${doc!.id}`);
  const resposta = await page.request.get(`/api/documentos?id=${doc!.id}`, { maxRedirects: 0 });
  expect(resposta.status()).toBe(307);
  expect(resposta.headers().location).toMatch(/\/storage\/v1\/object\/sign\/documentos\//);
  const { count } = await db.from('auditoria_acessos').select('*', { count: 'exact', head: true }).eq('acao', 'download').eq('entidade_id', doc!.id);
  expect(count).toBe(1);
});

test('erro de preenchimento vira aviso na tela, sem quebrar a página', async ({ page }) => {
  const id = await empresaDeTeste();
  await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Hortsul' });
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}?aba=clientes`);
  await page.getByPlaceholder('Nome da unidade (ex.: Santa Efigênia)').fill('Itabira');
  await page.getByPlaceholder('CNPJ').fill('11.222.333/0001-99');
  await page.getByRole('button', { name: 'Adicionar unidade' }).click();
  await expect(page.getByText(/Não foi possível salvar: .*CNPJ inválido/)).toBeVisible();
  await expect(page.getByLabel('Nome de Hortsul')).toBeVisible();

  await page.goto('/clientes/novo');
  await page.getByLabel('Razão social').fill('Cliente Com CNPJ Errado');
  await page.getByLabel('CNPJ').fill('11.222.333/0001-99');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText(/Não foi possível salvar: .*CNPJ inválido/)).toBeVisible();
});

test('preço tem botão Salvar', async ({ page }) => {
  const id = await empresaDeTeste();
  await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Supermercado Brasil' });
  await db.from('produtos').insert({ cliente_id: id, codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC' });
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}?aba=precos`);
  await page.getByLabel('Preço de Costela com Requeijão para Supermercado Brasil', { exact: true }).fill('12,30');
  await page.getByRole('button', { name: 'Salvar preço de Costela com Requeijão para Supermercado Brasil' }).click();
  await expect(page.getByLabel('Preço de Costela com Requeijão para Supermercado Brasil', { exact: true })).toHaveValue('12,30');
  await expect.poll(async () => (await db.from('precos').select('valor').eq('cliente_id', id).is('vigente_ate', null).single()).data?.valor).toBe(12.3);
});

test('histórico mostra quando o preço foi alterado pelo agente IA e a pedido de quem', async ({ page }) => {
  const id = await empresaDeTeste();
  const { data: rede } = await db.from('parceiros_grupos').insert({ cliente_id: id, tipo: 'cliente', nome: 'Supermercado Brasil' }).select().single();
  const { data: prod } = await db.from('produtos').insert({ cliente_id: id, codigo: '12', descricao: 'Costela com Requeijão', unidade: 'PAC' }).select().single();
  await db.from('contatos').delete().eq('telefone', '5531999990601');
  const { data: luana } = await db.from('contatos').insert({ nome: 'Luana', telefone: '5531999990601' }).select().single();
  await db.from('precos').insert({ cliente_id: id, grupo_id: rede!.id, produto_id: prod!.id, valor: 9.5, vigente_ate: new Date().toISOString() });
  await db.from('precos').insert({ cliente_id: id, grupo_id: rede!.id, produto_id: prod!.id, valor: 10, origem: 'agente', alterado_por_contato: luana!.id });
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: 'senha-forte-123', nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@teste.com', 'senha-forte-123');
  await page.goto(`/clientes/${id}?aba=precos&historico=${rede!.id}:${prod!.id}`);
  await expect(page.getByText(/R\$ 10,00 · vigente .* · alterado pelo agente IA \(a pedido de Luana\)/)).toBeVisible();
});
