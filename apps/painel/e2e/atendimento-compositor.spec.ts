import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

const SENHA = 'senha-forte-123';
const TEL = '5531970030001';
const HIDRATADA = 'data-conversa-hidratada';
// A primeira checagem de cada tela pode esperar a rota compilar; a sugestão é lida a cada ≤ 3 s.
const LONGO = { timeout: 30_000 };

async function cenario(comEmpresa = true) {
  await db.from('chamados').delete().eq('titulo', 'Preço da costela para conferir');
  await db.from('conversas').delete().eq('telefone', TEL);
  await db.from('contatos').delete().eq('telefone', TEL);
  await db.from('clientes').delete().eq('cnpj', '11222333000181');
  const { data: setor } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: cliente } = await db.from('clientes').insert({ razao_social: 'Rede Compositor Ltda', cnpj: '11222333000181' }).select().single();
  const { data: contato } = await db.from('contatos').insert({ nome: 'Carla Compositor', telefone: TEL }).select().single();
  if (comEmpresa) await db.from('contato_clientes').insert({ contato_id: contato!.id, cliente_id: cliente!.id });
  const { data: c } = await db.from('conversas').insert({ telefone: TEL, contato_id: contato!.id, cliente_em_foco: comEmpresa ? cliente!.id : null }).select().single();
  await db.from('chamados').insert({ conversa_id: c!.id, cliente_id: comEmpresa ? cliente!.id : null, setor_id: setor!.id, titulo: 'Compositor e2e' });
  await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: 'Qual o preço da costela?', processada_em: new Date().toISOString() });
  return c!.id;
}
const contarMensagens = async (conversa: string) => (await db.from('mensagens').select('id', { count: 'exact', head: true }).eq('conversa_id', conversa)).count;

/** O pedido que o painel gravou (a ação do servidor pode demorar a compilar na primeira vez). */
async function pedidoDe(usuario: string) {
  await expect.poll(async () => (await db.from('sugestoes_resposta').select('id').eq('usuario_id', usuario)).data?.length, LONGO).toBe(1);
  const { data } = await db.from('sugestoes_resposta').select('id, status').eq('usuario_id', usuario).single();
  return data!;
}

/** Abre a conversa e espera a hidratação (formulário e atalhos já respondem). */
async function abrir(page: Page, conversa: string) {
  await page.goto(`/atendimento/${conversa}`);
  await expect(page.locator('body')).toHaveAttribute(HIDRATADA, '', LONGO);
}

test('Enter envia e Shift+Enter quebra a linha', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-comp@e2e.local', senha: SENHA, nome: 'Ana Comp', papel: 'atendente', setores: ['Fiscal'] });
  const conversa = await cenario();
  await entrar(page, 'ana-comp@e2e.local', SENHA);
  await abrir(page, conversa);
  const campo = page.getByLabel('Resposta para o cliente');
  await campo.fill('Linha um');
  await campo.press('Shift+Enter');
  await campo.pressSequentially('Linha dois');
  await campo.press('Enter');
  await expect(page.getByRole('log', { name: 'Histórico da conversa' }).getByText(/Linha um\s+Linha dois/)).toBeVisible(LONGO);
});

test('J, K, A e N digitados no compositor ficam no texto (não disparam atalhos)', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-comp@e2e.local', senha: SENHA, nome: 'Ana Comp', papel: 'atendente', setores: ['Fiscal'] });
  const conversa = await cenario();
  await entrar(page, 'ana-comp@e2e.local', SENHA);
  await abrir(page, conversa);
  const campo = page.getByLabel('Resposta para o cliente');
  await campo.click();
  await campo.pressSequentially('jkan');
  await expect(campo).toHaveValue('jkan');
  await expect(page).toHaveURL(new RegExp(`/atendimento/${conversa}`));
  await expect(page.getByRole('tab', { name: 'Responder ao cliente' })).toHaveAttribute('data-state', 'active');
});

test('Sugerir resposta: nada é gravado na conversa até ENVIAR; edita e envia (spec 7A.1)', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-comp@e2e.local', senha: SENHA, nome: 'Ana Comp', papel: 'atendente', setores: ['Fiscal'], permissoes: ['assistente_site'] });
  const conversa = await cenario();
  const antes = await contarMensagens(conversa);
  await entrar(page, 'ana-comp@e2e.local', SENHA);
  await abrir(page, conversa);
  await page.getByRole('button', { name: 'Sugerir resposta' }).click();
  await expect(page.getByText('Preparando sugestão…')).toBeVisible(LONGO);
  // O trabalhador não roda no e2e: faz o papel dele, gravando o resultado do pedido que o painel criou.
  const s = await pedidoDe(ana);
  expect(s.status).toBe('pendente');
  expect(await contarMensagens(conversa)).toBe(antes);
  await db.from('sugestoes_resposta').update({ status: 'pronta', texto: 'Oi, Carla! A costela sai a R$ 9,50.', concluida_em: new Date().toISOString() }).eq('id', s.id);
  const campo = page.getByLabel('Resposta para o cliente');
  await expect(campo).toHaveValue('Oi, Carla! A costela sai a R$ 9,50.', LONGO);
  await expect(page.getByText('Sugestão do assistente (editável)')).toBeVisible();
  // Sugerir nunca envia: depois de a sugestão chegar, nenhuma mensagem foi gravada.
  expect(await contarMensagens(conversa)).toBe(antes);
  await campo.fill('Oi, Carla! A costela sai a R$ 9,50 a unidade.');
  await page.getByRole('tabpanel', { name: 'Responder ao cliente' }).getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('log', { name: 'Histórico da conversa' }).getByText('Oi, Carla! A costela sai a R$ 9,50 a unidade.')).toBeVisible(LONGO);
  expect(await contarMensagens(conversa)).toBe((antes ?? 0) + 1);
});

test('sugestão com texto já digitado não sobrescreve (P12)', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-comp@e2e.local', senha: SENHA, nome: 'Ana Comp', papel: 'atendente', setores: ['Fiscal'], permissoes: ['assistente_site'] });
  const conversa = await cenario();
  const antes = await contarMensagens(conversa);
  await entrar(page, 'ana-comp@e2e.local', SENHA);
  await abrir(page, conversa);
  const campo = page.getByLabel('Resposta para o cliente');
  await campo.fill('Meu rascunho');
  await page.getByRole('button', { name: 'Sugerir resposta' }).click();
  await expect(page.getByText('Preparando sugestão…')).toBeVisible(LONGO);
  const s = await pedidoDe(ana);
  await db.from('sugestoes_resposta').update({ status: 'pronta', texto: 'Texto sugerido', concluida_em: new Date().toISOString() }).eq('id', s.id);
  await expect(page.getByText('Sugestão pronta')).toBeVisible(LONGO);
  await expect(campo).toHaveValue('Meu rascunho');
  expect(await contarMensagens(conversa)).toBe(antes);
  await page.getByRole('button', { name: 'Usar sugestão' }).click();
  await expect(campo).toHaveValue('Texto sugerido');
  expect(await contarMensagens(conversa)).toBe(antes);
});

test('sugestão que falha mostra o aviso e não grava nada', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-comp@e2e.local', senha: SENHA, nome: 'Ana Comp', papel: 'atendente', setores: ['Fiscal'], permissoes: ['assistente_site'] });
  const conversa = await cenario();
  const antes = await contarMensagens(conversa);
  await entrar(page, 'ana-comp@e2e.local', SENHA);
  await abrir(page, conversa);
  await page.getByRole('button', { name: 'Sugerir resposta' }).click();
  await expect(page.getByText('Preparando sugestão…')).toBeVisible(LONGO);
  const s = await pedidoDe(ana);
  await db.from('sugestoes_resposta').update({ status: 'falhou', erro: 'A IA ficou fora do ar.', concluida_em: new Date().toISOString() }).eq('id', s.id);
  await expect(page.getByText('A IA ficou fora do ar.')).toBeVisible(LONGO);
  await expect(page.getByLabel('Resposta para o cliente')).toHaveValue('');
  expect(await contarMensagens(conversa)).toBe(antes);
});

test('sem o assistente, o botão não aparece', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-comp@e2e.local', senha: SENHA, nome: 'Ana Comp', papel: 'atendente', setores: ['Fiscal'] });
  const conversa = await cenario();
  await entrar(page, 'ana-comp@e2e.local', SENHA);
  await abrir(page, conversa);
  await expect(page.getByRole('button', { name: 'Sugerir resposta' })).toHaveCount(0);
});

test('Abrir demanda: painel da Parte C com empresa, contato e conversa ligados', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-comp@e2e.local', senha: SENHA, nome: 'Ana Comp', papel: 'atendente', setores: ['Fiscal'] });
  const conversa = await cenario();
  await entrar(page, 'ana-comp@e2e.local', SENHA);
  await abrir(page, conversa);
  await page.getByRole('button', { name: 'Abrir demanda' }).click();
  const painel = page.getByRole('dialog', { name: 'Nova demanda' });
  await expect(painel.getByLabel('Empresa', { exact: true })).toContainText('Rede Compositor Ltda', LONGO);
  await expect(painel.getByLabel('Contato na empresa')).toHaveValue(/.+/);
  await painel.getByLabel('Setor').selectOption({ label: 'Fiscal' });
  await painel.getByLabel('Título').fill('Preço da costela para conferir');
  await painel.getByRole('button', { name: 'Abrir demanda' }).click();
  await expect(page.getByText(/Demanda #\d+ aberta\./)).toBeVisible(LONGO);
  await expect(painel).toHaveCount(0);
  const { data: d } = await db.from('chamados').select('numero, conversa_id, origem').eq('titulo', 'Preço da costela para conferir').single();
  expect(d).toMatchObject({ conversa_id: conversa, origem: 'equipe' });
  await expect(page.getByRole('log', { name: 'Histórico da conversa' }).getByText(`Demanda #${d!.numero} aberta no Fiscal · normal`)).toBeVisible(LONGO);
});

test('Abrir demanda desligado em conversa sem empresa, com a explicação (P22)', async ({ page }) => {
  await criarUsuarioTeste({ email: 'ana-comp@e2e.local', senha: SENHA, nome: 'Ana Comp', papel: 'atendente', setores: ['Fiscal'] });
  const conversa = await cenario(false);
  await entrar(page, 'ana-comp@e2e.local', SENHA);
  await abrir(page, conversa);
  const botao = page.getByRole('button', { name: 'Abrir demanda' });
  await expect(botao).toBeDisabled();
  await expect(botao).toHaveAccessibleDescription('Cadastre o contato e a empresa antes de abrir uma demanda.');
  await expect(page.getByText('Cadastre o contato e a empresa antes de abrir uma demanda.')).toBeVisible();
});
