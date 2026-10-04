import { expect, test, type Page } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { editor, esperarTreinar } from './apoio-treinar';

// Tela Treinar o agente (spec 2026-09-30 §5): criar pelo exemplo, editar, ligar na tabela, histórico/restaurar
// e quem vê a tela (administrador, marcado em Usuários; atendente sem a marcação não) (desde a G5, em três colunas: lista, editor e simulador).

const senha = 'Senha-e2e-123';
const EMAIL_ADMIN = 'admin-treinar@e2e.local';
const EMAIL_SEM = 'sem-treinar@e2e.local';
const EMAIL_COM = 'com-treinar@e2e.local';
const CNPJ = '45321789000110';
const EMPRESA = 'Padaria Treino Ltda';

async function limpar() {
  // Só o banco local dos testes: nenhum outro spec cria orientações.
  await db.from('orientacoes_agente').delete().not('id', 'is', null);
  await db.from('clientes').delete().eq('cnpj', CNPJ);
}

test.beforeEach(limpar);
test.afterAll(async () => {
  await limpar();
  const { data: lista } = await db.auth.admin.listUsers();
  for (const u of lista.users.filter((x) => [EMAIL_ADMIN, EMAIL_SEM, EMAIL_COM].includes(x.email ?? ''))) await db.auth.admin.deleteUser(u.id);
});

async function orientacao(titulo: string) {
  const { data } = await db.from('orientacoes_agente').select('id, titulo, texto, tipo, cliente_id, setor_id, ativo').eq('titulo', titulo).maybeSingle();
  return data;
}
async function versoes(id: string) {
  const { data } = await db.from('orientacoes_agente_versoes').select('acao, texto, ativo').eq('orientacao_id', id).order('criado_em');
  return data ?? [];
}

const painel = (page: Page) => editor(page);

test('administrador cria pelo exemplo, edita, liga na tabela e restaura uma versão', async ({ page }) => {
  await criarUsuarioTeste({ email: EMAIL_ADMIN, senha, nome: 'Dono Treino', papel: 'admin' });
  const { data: cliente } = await db.from('clientes').insert({ razao_social: EMPRESA, nome_fantasia: 'Padaria Treino', cnpj: CNPJ }).select('id').single();
  await entrar(page, EMAIL_ADMIN, senha);

  // Menu -> tela vazia com os três exemplos e o medidor zerado.
  await page.getByRole('link', { name: 'Treinar o agente' }).click();
  await esperarTreinar(page);
  await expect(page.getByRole('heading', { name: 'Treinar o agente' })).toBeVisible();
  await expect(page.getByText('Nenhuma orientação ainda.')).toBeVisible();
  await expect(page.getByRole('progressbar', { name: 'Espaço usado pelas orientações ligadas' })).toHaveAttribute('aria-valuetext', '0 de 12.000 caracteres');
  await expect(page.getByRole('link', { name: /Usar este exemplo/ })).toHaveCount(3);

  // Criar a partir do exemplo "Cumprimento": o formulário vem preenchido; salva desligada.
  await page.getByRole('link', { name: /Cumprimento/ }).click();
  await expect(painel(page).getByRole('heading', { name: 'Nova orientação' })).toBeVisible();
  await expect(painel(page).getByLabel('Título')).toHaveValue('Cumprimento');
  await expect(painel(page).getByRole('radio', { name: /Jeito de atender/ })).toBeChecked();
  await painel(page).getByRole('button', { name: 'Salvar desligada' }).click();
  await expect(painel(page).getByRole('heading', { name: 'Cumprimento' })).toBeVisible();
  await expect(page).toHaveURL(/orientacao=[0-9a-f-]{36}/);
  const criada = await orientacao('Cumprimento');
  expect(criada).toMatchObject({ texto: 'Comece sempre pelo nome do cliente e responda em no máximo duas frases.', tipo: 'jeito', cliente_id: null, ativo: false });
  expect((await versoes(criada!.id)).map((v) => v.acao)).toEqual(['criar']);

  // Editar: texto novo e vale só para uma empresa (busca no campo da empresa).
  await painel(page).getByLabel('O que o agente deve fazer').fill('Chame o cliente pelo nome e seja breve.');
  // Desde a G5 o rádio fica escondido (sr-only) sob o segmento: marca-se pelo rótulo, como a pessoa faz.
  await painel(page).getByRole('radio', { name: 'Uma empresa' }).locator('xpath=..').check();
  await painel(page).getByRole('combobox', { name: 'Empresa' }).click();
  await page.getByRole('combobox', { name: 'Buscar empresa' }).fill('Treino');
  await page.getByRole('option', { name: /Padaria Treino/ }).click();
  await expect(painel(page).getByText('Rascunho não salvo')).toBeVisible();
  await painel(page).getByRole('button', { name: 'Salvar desligada' }).click();
  await expect.poll(async () => (await orientacao('Cumprimento'))?.cliente_id).toBe(cliente!.id);
  expect((await orientacao('Cumprimento'))?.texto).toBe('Chame o cliente pelo nome e seja breve.');
  await expect(painel(page).getByText('Empresa Padaria Treino')).toBeVisible();

  // Fechar o painel e ligar pela chave da linha (otimista; o banco grava).
  await page.goto('/treinar-agente');
  await esperarTreinar(page);
  const linha = page.getByRole('listitem').filter({ hasText: 'Cumprimento' });
  await expect(linha.getByText('Padaria Treino')).toBeVisible();
  await linha.getByRole('switch', { name: 'Ligar a orientação Cumprimento' }).click();
  await expect.poll(async () => (await orientacao('Cumprimento'))?.ativo).toBe(true);
  await expect(linha.getByRole('switch', { name: 'Desligar a orientação Cumprimento' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('progressbar', { name: 'Espaço usado pelas orientações ligadas' })).toHaveAttribute('aria-valuetext', /^[1-9]\d* de 12\.000 caracteres$/);

  // Filtro por situação: desligadas não mostra a orientação ligada.
  await page.goto('/treinar-agente?ativo=desligadas');
  await esperarTreinar(page);
  await expect(page.getByText('Nenhuma orientação neste filtro.')).toBeVisible();
  await page.goto('/treinar-agente');
  await esperarTreinar(page);

  // Histórico: criar, editar, ligar; restaurar a primeira versão volta o texto e a empresa, e continua ligada.
  await page.getByRole('link', { name: /Cumprimento/ }).click();
  await expect(painel(page).getByRole('heading', { name: 'Histórico · 3 versões' })).toBeVisible();
  await expect(painel(page).getByText('Criou (desligada)')).toBeVisible();
  await expect(painel(page).getByText('Editou: vale para e texto')).toBeVisible();
  await expect(painel(page).getByText('Ligou')).toBeVisible();
  // Só a versão com conteúdo diferente do atual pode ser restaurada (a criação).
  await expect(painel(page).getByRole('button', { name: 'Restaurar esta versão' })).toHaveCount(1);
  await painel(page).getByRole('button', { name: 'Restaurar esta versão' }).click();
  const confirmar = page.getByRole('dialog', { name: 'Restaurar esta versão?' });
  await expect(confirmar.getByText('A orientação continua ligada: restaurar não liga nem desliga nada.', { exact: false })).toBeVisible();
  await confirmar.getByRole('button', { name: 'Restaurar' }).click();
  await expect.poll(async () => (await orientacao('Cumprimento'))?.cliente_id ?? null).toBeNull();
  const restaurada = await orientacao('Cumprimento');
  expect(restaurada).toMatchObject({ texto: 'Comece sempre pelo nome do cliente e responda em no máximo duas frases.', ativo: true });
  expect((await versoes(restaurada!.id)).map((v) => v.acao)).toEqual(['criar', 'editar', 'ligar', 'restaurar']);
  await expect(painel(page).getByRole('heading', { name: 'Histórico · 4 versões' })).toBeVisible();
  await expect(painel(page).getByText('Restaurou uma versão anterior: vale para e texto')).toBeVisible();
});

test('erro do banco volta na tela: ligar orientação de empresa inativa mostra o motivo e a chave volta', async ({ page }) => {
  await criarUsuarioTeste({ email: EMAIL_ADMIN, senha, nome: 'Dono Treino', papel: 'admin' });
  const { data: cliente } = await db.from('clientes').insert({ razao_social: EMPRESA, nome_fantasia: 'Padaria Treino', cnpj: CNPJ }).select('id').single();
  await db.from('orientacoes_agente').insert({ titulo: 'Boleto', texto: 'Boleto vai para o Financeiro.', tipo: 'regra', cliente_id: cliente!.id });
  await db.from('clientes').update({ ativo: false }).eq('id', cliente!.id);
  await entrar(page, EMAIL_ADMIN, senha);
  await page.goto('/treinar-agente');
  await esperarTreinar(page);
  const linha = page.getByRole('listitem').filter({ hasText: 'Boleto' });
  await expect(linha.getByText('arquivada')).toBeVisible();
  await linha.getByRole('switch', { name: 'Ligar a orientação Boleto' }).click();
  await expect(page.getByText(/Não consegui ligar a orientação "Boleto"\. Esta empresa está arquivada/)).toBeVisible();
  await expect(linha.getByRole('switch', { name: 'Ligar a orientação Boleto' })).toHaveAttribute('aria-checked', 'false');
  expect((await orientacao('Boleto'))?.ativo).toBe(false);

  // Formulário: a mensagem do banco aparece no painel (?erro=).
  await page.goto(`/treinar-agente?orientacao=nova&erro=${encodeURIComponent('Setor não encontrado.')}`);
  await esperarTreinar(page);
  await expect(painel(page).getByRole('alert')).toHaveText('Setor não encontrado.');
});

test('atendente sem a marcação não vê o menu e a tela explica quem libera; marcado em Usuários, vê e cria', async ({ page }) => {
  await criarUsuarioTeste({ email: EMAIL_ADMIN, senha, nome: 'Dono Treino', papel: 'admin' });
  const semId = await criarUsuarioTeste({ email: EMAIL_SEM, senha, nome: 'Bia Sem Treino', papel: 'atendente', setores: ['Fiscal'] });

  await entrar(page, EMAIL_SEM, senha);
  await expect(page.getByRole('link', { name: 'Treinar o agente' })).toHaveCount(0);
  await page.goto('/treinar-agente');
  await expect(page.getByText('Você não tem acesso a esta tela.')).toBeVisible();
  await expect(page.getByText('Quem libera é o administrador: na tela Usuários, ele escolhe "Sim" em "Treinar o agente" no seu cadastro.')).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);

  // O administrador escolhe "Sim" em "Treinar o agente" na ficha da pessoa.
  await page.context().clearCookies();
  await entrar(page, EMAIL_ADMIN, senha);
  await page.goto(`/usuarios/${semId}`);
  const form = page.getByRole('form', { name: 'Cadastro de Bia Sem Treino' });
  await expect(form.getByText('Escreve e liga as orientações que o agente segue.')).toBeVisible({ timeout: 30_000 });
  await form.getByLabel('Treinar o agente').selectOption('sim');
  await form.getByRole('button', { name: 'Salvar' }).click();
  await expect.poll(async () => (await db.from('usuarios').select('permissoes').eq('id', semId).single()).data?.permissoes).toEqual(['treinar_agente']);

  // Marcada, a atendente vê o item e cria uma orientação (o banco grava com a sessão dela).
  await page.context().clearCookies();
  await entrar(page, EMAIL_SEM, senha);
  await page.getByRole('link', { name: 'Treinar o agente' }).click();
  await esperarTreinar(page);
  await page.getByRole('link', { name: 'Nova orientação' }).click();
  await painel(page).getByLabel('Título').fill('Horário');
  await painel(page).getByRole('radio', { name: /Regra do escritório/ }).locator('xpath=..').check();
  await painel(page).getByLabel('O que o agente deve fazer').fill('O escritório atende das 8h às 18h.');
  await painel(page).getByRole('button', { name: 'Salvar e ligar' }).click();
  await expect(painel(page).getByRole('heading', { name: 'Horário' })).toBeVisible();
  const { data } = await db.from('orientacoes_agente').select('tipo, ativo, criado_por').eq('titulo', 'Horário').single();
  expect(data).toEqual({ tipo: 'regra', ativo: true, criado_por: semId });
});

test('formulário: "Uma empresa" sem empresa não envia nem perde o texto; voltar para Todos não conta como alteração', async ({ page }) => {
  await criarUsuarioTeste({ email: EMAIL_ADMIN, senha, nome: 'Dono Treino', papel: 'admin' });
  await db.from('clientes').insert({ razao_social: EMPRESA, nome_fantasia: 'Padaria Treino', cnpj: CNPJ });
  const { data: criada } = await db.from('orientacoes_agente').insert({ titulo: 'Prazo', texto: 'Até as 15h.', tipo: 'regra' }).select('id').single();
  await entrar(page, EMAIL_ADMIN, senha);

  // Nova: texto digitado, "Uma empresa" sem escolher -> aviso no campo, nada enviado, texto continua.
  await page.goto('/treinar-agente?orientacao=nova');
  await esperarTreinar(page);
  await painel(page).getByLabel('Título').fill('Sem empresa');
  await painel(page).getByLabel('O que o agente deve fazer').fill('Texto que não pode sumir.');
  await painel(page).getByRole('radio', { name: 'Uma empresa' }).locator('xpath=..').check();
  await painel(page).getByRole('button', { name: 'Salvar desligada' }).click();
  await expect(painel(page).getByText('Escolha a empresa.')).toBeVisible();
  await expect(page).not.toHaveURL(/erro=/);
  await expect(painel(page).getByLabel('O que o agente deve fazer')).toHaveValue('Texto que não pode sumir.');
  expect(await orientacao('Sem empresa')).toBeNull();

  // Existente: escolher uma empresa e voltar para Todos não deixa "Alterações não salvas".
  await page.goto(`/treinar-agente?orientacao=${criada!.id}`);
  await esperarTreinar(page);
  await painel(page).getByRole('radio', { name: 'Uma empresa' }).locator('xpath=..').check();
  await painel(page).getByRole('combobox', { name: 'Empresa' }).click();
  await page.getByRole('option', { name: /Padaria Treino/ }).click();
  await expect(painel(page).getByText('Rascunho não salvo')).toBeVisible();
  await painel(page).getByRole('radio', { name: 'Todos os clientes' }).locator('xpath=..').check();
  await expect(painel(page).getByText('Rascunho não salvo')).toHaveCount(0);

  // Salvar sem mudar nada não grava versão.
  await painel(page).getByRole('button', { name: 'Salvar desligada' }).click();
  await page.waitForLoadState('networkidle');
  expect(await versoes(criada!.id)).toEqual([]);
});
