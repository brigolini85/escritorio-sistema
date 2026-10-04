import { expect, test } from '@playwright/test';
import { tamanhoOrientacao } from '../src/lib/orientacoes';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirTreinar, editor, lista, simulador } from './apoio-treinar';

// Treinar o agente, Opção B (spec 7C.5): simulador com e sem rascunho, salvar desligada/ligada, lista.
// Sem trabalhador nos e2e: o resultado da simulação é gravado direto no banco local (service role), como o trabalhador gravaria.

const senha = 'Senha-e2e-123';
const EMAIL = 'ana-g5@e2e.local';
const CNPJ = '45321789000372';
const P = 'G5E2E';

async function limpar() {
  // Só o banco local dos testes; os specs do Treinar apagam todas as orientações antes de cada teste.
  await db.from('orientacoes_agente').delete().not('id', 'is', null);
  await db.from('clientes').delete().eq('cnpj', CNPJ);
}

test.beforeEach(limpar);
test.afterAll(async () => {
  await limpar();
  // Apagar o login apaga a pessoa e as simulações dela (cascata).
  const { data } = await db.auth.admin.listUsers();
  for (const u of data.users.filter((x) => x.email === EMAIL)) await db.auth.admin.deleteUser(u.id);
});

const criarAna = () => criarUsuarioTeste({ email: EMAIL, senha, nome: 'Ana G5', papel: 'admin' });

async function simulacoes(usuarioId: string) {
  const { data } = await db.from('simulacoes_agente').select('id, mensagem, cliente_id, rascunho, status').eq('usuario_id', usuarioId).order('criado_em');
  return data ?? [];
}
async function pronta(id: string, respostas: { mensagens: string[]; acoes: { ferramenta: string; resumo: string }[]; observacoes: string[] }) {
  await db.from('simulacoes_agente').update({ status: 'pronta', respostas }).eq('id', id);
}
async function versoes(id: string) {
  const { data } = await db.from('orientacoes_agente_versoes').select('acao').eq('orientacao_id', id).order('criado_em');
  return (data ?? []).map((v) => v.acao);
}

test('o simulador usa o rascunho sem salvar e "Sem o rascunho" faz uma segunda simulação, sem rascunho', async ({ page }) => {
  const usuario = await criarAna();
  const { data: cliente } = await db.from('clientes').insert({ razao_social: `${P} Rede Bom Preço Ltda`, nome_fantasia: `${P} Rede Bom Preço`, cnpj: CNPJ }).select('id').single();
  const TITULO = `${P} Nota com unidade fora do cadastro`;
  const { data: o } = await db.from('orientacoes_agente')
    .insert({ titulo: TITULO, texto: 'Pergunte o CNPJ da unidade.', tipo: 'situacao', cliente_id: cliente!.id, ativo: false }).select('id').single();
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page, `?orientacao=${o!.id}`);

  // Rascunho sem salvar: o simulador já usa, com a empresa do rascunho.
  const novo = 'Quando pedirem nota para uma unidade fora do cadastro, não pergunte o CNPJ: diga que vai conferir com a equipe e abra a demanda no Fiscal.';
  await editor(page).getByLabel('O que o agente deve fazer').fill(novo);
  await expect(editor(page).getByText('Rascunho não salvo')).toBeVisible();
  await expect(simulador(page).getByText('usando o rascunho, ligado')).toBeVisible();
  await expect(simulador(page).getByRole('combobox', { name: 'Como cliente de' })).toHaveText(/Rede Bom Preço/);

  await simulador(page).getByLabel('Mensagem do cliente').fill('Bom dia! Preciso de uma nota pra Unidade Centro.');
  await simulador(page).getByRole('button', { name: 'Testar', exact: true }).click();
  await expect(simulador(page).getByRole('status').filter({ hasText: 'Pensando…' })).toBeVisible();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(1);
  const [primeira] = await simulacoes(usuario);
  expect(primeira).toMatchObject({
    mensagem: 'Bom dia! Preciso de uma nota pra Unidade Centro.', cliente_id: cliente!.id, status: 'pendente',
    rascunho: { id: o!.id, titulo: TITULO, texto: novo, tipo: 'situacao', cliente_id: cliente!.id, setor_id: null },
  });
  await expect(simulador(page).getByText('Teste com o rascunho')).toContainText(TITULO);
  // Nada salvo.
  expect((await db.from('orientacoes_agente').select('texto, ativo').eq('id', o!.id).single()).data).toEqual({ texto: 'Pergunte o CNPJ da unidade.', ativo: false });

  await pronta(primeira!.id, {
    mensagens: ['Bom dia! Anotei a Unidade Centro. Vou conferir com a equipe antes de emitir.'],
    acoes: [{ ferramenta: 'abrir_chamado', resumo: 'Abriria uma demanda no Fiscal: Nota para unidade fora do cadastro' }],
    observacoes: [],
  });
  await expect(simulador(page).getByText('Vou conferir com a equipe antes de emitir.')).toBeVisible({ timeout: 10_000 });
  await expect(simulador(page).getByRole('heading', { name: 'O que o agente faria' })).toBeVisible();
  await expect(simulador(page).getByText('Abriria uma demanda no Fiscal: Nota para unidade fora do cadastro')).toBeVisible();

  // Sem o rascunho: segunda simulação, mesma mensagem e empresa, rascunho nulo; enquanto roda, Testar fica desligado.
  const sem = simulador(page).getByRole('region', { name: 'Sem o rascunho' });
  await expect(sem.getByText('conta em Gastos com IA')).toBeVisible();
  await sem.getByRole('button', { name: 'Comparar sem o rascunho' }).click();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(2);
  const segunda = (await simulacoes(usuario))[1]!;
  expect(segunda).toMatchObject({ mensagem: primeira!.mensagem, cliente_id: cliente!.id, rascunho: null, status: 'pendente' });
  await expect(sem.getByText('Pensando…')).toBeVisible();
  await expect(simulador(page).getByRole('button', { name: 'Testar', exact: true })).toBeDisabled();
  await pronta(segunda.id, { mensagens: ['Bom dia! Qual o CNPJ da Unidade Centro?'], acoes: [], observacoes: [] });
  await expect(sem.getByText('Bom dia! Qual o CNPJ da Unidade Centro?')).toBeVisible({ timeout: 10_000 });
  await expect(sem.getByText('Nenhuma ação.')).toBeVisible();

  // As duas respostas na tela; o rascunho continua no formulário; nada gravado na orientação.
  await expect(simulador(page).getByText('Vou conferir com a equipe antes de emitir.')).toBeVisible();
  await expect(editor(page).getByLabel('O que o agente deve fazer')).toHaveValue(novo);
  expect((await db.from('orientacoes_agente').select('texto, ativo').eq('id', o!.id).single()).data).toEqual({ texto: 'Pergunte o CNPJ da unidade.', ativo: false });
  expect(await versoes(o!.id)).toEqual([]);
});

test('orientação ligada sem mudança não oferece comparação; sem orientação aberta, testa só as ligadas', async ({ page }) => {
  const usuario = await criarAna();
  const TITULO = `${P} Cumprimento`;
  const { data: o } = await db.from('orientacoes_agente').insert({ titulo: TITULO, texto: 'Comece pelo nome do cliente.', tipo: 'jeito', ativo: true }).select('id').single();
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page, `?orientacao=${o!.id}`);
  await expect(simulador(page).getByText('usando esta orientação, ligada')).toBeVisible();
  await simulador(page).getByLabel('Mensagem do cliente').fill('Oi, bom dia');
  await simulador(page).getByRole('button', { name: 'Testar', exact: true }).click();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(1);
  const [s] = await simulacoes(usuario);
  expect(s!.rascunho).toEqual({ id: o!.id, titulo: TITULO, texto: 'Comece pelo nome do cliente.', tipo: 'jeito', cliente_id: null, setor_id: null });
  await pronta(s!.id, { mensagens: ['Bom dia! Em que posso ajudar?'], acoes: [], observacoes: [] });
  await expect(simulador(page).getByText('Bom dia! Em que posso ajudar?')).toBeVisible({ timeout: 10_000 });
  await expect(simulador(page).getByRole('region', { name: 'Sem o rascunho' })).toHaveCount(0);

  await abrirTreinar(page);
  await expect(simulador(page).getByText('orientações ligadas, sem rascunho')).toBeVisible();
  await expect(editor(page).getByText('Escolha uma orientação na lista.')).toBeVisible();
  await simulador(page).getByLabel('Mensagem do cliente').fill('Oi de novo');
  await simulador(page).getByRole('button', { name: 'Testar', exact: true }).click();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(2);
  expect((await simulacoes(usuario))[1]).toMatchObject({ mensagem: 'Oi de novo', cliente_id: null, rascunho: null, status: 'pendente' });
});

test('Salvar desligada, Salvar e ligar, Enter no título, chave do alto sem perder o rascunho e Descartar', async ({ page }) => {
  await criarAna();
  const TITULO = `${P} Prazo da folha`;
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page, '?orientacao=nova');
  await expect(editor(page).getByRole('heading', { name: 'Nova orientação' })).toBeVisible();
  await editor(page).getByLabel('Título').fill(TITULO);
  // O rádio fica escondido (sr-only) sob o segmento: clica-se no rótulo, como a pessoa faz.
  await editor(page).getByRole('radio', { name: /Regra do escritório/ }).locator('xpath=..').click();
  await expect(editor(page).getByRole('radio', { name: /Regra do escritório/ })).toBeChecked();
  await editor(page).getByLabel('O que o agente deve fazer').fill('A folha fecha no dia 20.');
  await editor(page).getByRole('button', { name: 'Salvar desligada' }).click();
  await expect(editor(page).getByRole('heading', { name: TITULO })).toBeVisible();
  const criada = (await db.from('orientacoes_agente').select('id, ativo, texto, tipo').eq('titulo', TITULO).single()).data!;
  expect(criada).toMatchObject({ ativo: false, texto: 'A folha fecha no dia 20.', tipo: 'regra' });

  // Enter no título não envia (o botão padrão seria Salvar desligada).
  await editor(page).getByLabel('Título').press('Enter');
  await page.waitForLoadState('networkidle');
  expect(await versoes(criada.id)).toEqual(['criar']);

  // Salvar e ligar grava o texto novo e liga.
  const texto = 'A folha fecha no dia 20; depois disso, só no mês seguinte.';
  await editor(page).getByLabel('O que o agente deve fazer').fill(texto);
  await editor(page).getByRole('button', { name: 'Salvar e ligar' }).click();
  await expect.poll(async () => (await db.from('orientacoes_agente').select('ativo').eq('id', criada.id).single()).data?.ativo).toBe(true);
  await expect(editor(page).getByRole('switch', { name: `Desligar a orientação ${TITULO}` })).toHaveAttribute('aria-checked', 'true');
  expect(await versoes(criada.id)).toEqual(['criar', 'editar']);

  // A chave do alto grava na hora e não apaga o rascunho.
  await editor(page).getByLabel('O que o agente deve fazer').fill('Rascunho que não pode sumir.');
  await editor(page).getByRole('switch', { name: `Desligar a orientação ${TITULO}` }).click();
  await expect.poll(async () => (await db.from('orientacoes_agente').select('ativo').eq('id', criada.id).single()).data?.ativo).toBe(false);
  await expect(editor(page).getByLabel('O que o agente deve fazer')).toHaveValue('Rascunho que não pode sumir.');

  // Descartar volta ao salvo, sem gravar.
  await editor(page).getByRole('button', { name: 'Descartar' }).click();
  await expect(editor(page).getByLabel('O que o agente deve fazer')).toHaveValue(texto);
  await expect(editor(page).getByText('Rascunho não salvo')).toHaveCount(0);
  await expect(editor(page).getByRole('button', { name: 'Descartar' })).toBeDisabled();
  expect(await versoes(criada.id)).toEqual(['criar', 'editar', 'desligar']);
});

test('lista: contagens, do Atendimento, campos a preencher, medidor, filtro e trocar de orientação com rascunho pergunta', async ({ page }) => {
  const usuario = await criarAna();
  const TITULO_ENS = `${P} Nota fora do cadastro`;
  const textoEns = 'Situação: Cliente: “nota pra Unidade Centro”\nO que fazer: Confirme com a equipe.';
  const { data: ens } = await db.from('orientacoes_agente')
    .insert({ titulo: TITULO_ENS, texto: textoEns, tipo: 'situacao', ativo: false, criado_por: usuario }).select('id').single();
  await db.from('orientacoes_agente_versoes').insert({ orientacao_id: ens!.id, acao: 'criar', titulo: TITULO_ENS, texto: textoEns, tipo: 'situacao', ativo: false, usuario_id: usuario });
  const TITULO_DADOS = `${P} Dados do escritório`;
  const textoDados = 'Endereço: (a preencher)\nPix: (a preencher)';
  const { data: dados } = await db.from('orientacoes_agente').insert({ titulo: TITULO_DADOS, texto: textoDados, tipo: 'regra', ativo: true }).select('id').single();
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page);

  await expect(lista(page).locator('[data-filtro="ligadas"]')).toHaveAttribute('data-contagem', '1');
  await expect(lista(page).locator('[data-filtro="desligadas"]')).toHaveAttribute('data-contagem', '1');
  await expect(lista(page).getByRole('listitem').filter({ hasText: TITULO_ENS }).getByText('do Atendimento')).toBeVisible();
  await expect(lista(page).getByRole('listitem').filter({ hasText: TITULO_DADOS }).getByText('2 campos a preencher')).toBeVisible();
  // Só a ligada conta no medidor.
  const n = tamanhoOrientacao({ tipo: 'regra', titulo: TITULO_DADOS, texto: textoDados });
  await expect(lista(page).getByRole('progressbar', { name: 'Espaço usado pelas orientações ligadas' })).toHaveAttribute('aria-valuetext', `${n} de 12.000 caracteres`);

  // A ensinada: marca no alto e "no Atendimento" na criação.
  await lista(page).getByRole('link', { name: new RegExp(TITULO_ENS) }).click();
  await expect(editor(page).getByText('Situação específica · ensinada no Atendimento')).toBeVisible();
  await expect(editor(page).getByText('Criada por Ana G5 no Atendimento')).toBeVisible();
  await expect(editor(page).getByText('Criou (desligada) no Atendimento')).toBeVisible();

  // Rascunho não salvo: trocar de orientação pergunta; cancelar fica, aceitar troca.
  await editor(page).getByLabel('O que o agente deve fazer').fill('Mudança sem salvar.');
  let pergunta = '';
  page.once('dialog', async (d) => { pergunta = d.message(); await d.dismiss(); });
  await lista(page).getByRole('link', { name: new RegExp(TITULO_DADOS) }).click();
  await expect.poll(() => pergunta).toContain('alterações não salvas');
  await expect(page).toHaveURL(new RegExp(`orientacao=${ens!.id}`));
  await expect(editor(page).getByLabel('O que o agente deve fazer')).toHaveValue('Mudança sem salvar.');
  page.once('dialog', (d) => d.accept());
  await lista(page).getByRole('link', { name: new RegExp(TITULO_DADOS) }).click();
  await expect(page).toHaveURL(new RegExp(`orientacao=${dados!.id}`));
  expect((await db.from('orientacoes_agente').select('texto').eq('id', ens!.id).single()).data?.texto).toBe(textoEns);

  // Filtro Desligadas.
  await lista(page).locator('[data-filtro="desligadas"]').click();
  await expect(lista(page).getByRole('listitem')).toHaveCount(1);
  await expect(lista(page).getByRole('listitem')).toContainText(TITULO_ENS);
});

// Itens adiados para a Task 6 (progress.md): Enter em rádio, Restaurar pela linha, teste retomado, comparação com
// ligar/salvar no meio e nenhum teste novo enquanto um roda.

test('Enter num rádio (Tipo e Vale para) não grava: a orientação ligada continua ligada e sem versão nova', async ({ page }) => {
  await criarAna();
  const TITULO = `${P} Tom das respostas`;
  const { data: o } = await db.from('orientacoes_agente').insert({ titulo: TITULO, texto: 'Responda em duas frases.', tipo: 'jeito', ativo: true }).select('id').single();
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page, `?orientacao=${o!.id}`);

  // Com alteração (o formulário teria o que enviar); o botão padrão seria Salvar desligada.
  await editor(page).getByLabel('O que o agente deve fazer').fill('Responda em uma frase.');
  // O rádio fica escondido (sr-only) sob o segmento: clica-se no rótulo, como a pessoa faz.
  await editor(page).getByRole('radio', { name: /Regra do escritório/ }).locator('xpath=..').click();
  await expect(editor(page).getByRole('radio', { name: /Regra do escritório/ })).toBeChecked();
  await editor(page).getByRole('radio', { name: /Regra do escritório/ }).press('Enter');
  await editor(page).getByRole('radio', { name: /Todos os clientes/ }).focus();
  await editor(page).getByRole('radio', { name: /Todos os clientes/ }).press('Enter');
  await page.waitForLoadState('networkidle');
  expect((await db.from('orientacoes_agente').select('texto, tipo, ativo').eq('id', o!.id).single()).data)
    .toEqual({ texto: 'Responda em duas frases.', tipo: 'jeito', ativo: true });
  expect(await versoes(o!.id)).toEqual([]);
  // O rascunho continua no formulário.
  await expect(editor(page).getByLabel('O que o agente deve fazer')).toHaveValue('Responda em uma frase.');
  await expect(editor(page).getByText('Rascunho não salvo')).toBeVisible();
});

test('Restaurar traz a versão da própria linha', async ({ page }) => {
  const usuario = await criarAna();
  const TITULO = `${P} Horário de atendimento`;
  const [a, b, c] = ['Atendemos das 8h às 17h.', 'Atendemos das 8h às 18h.', 'Atendemos das 9h às 18h.'];
  const { data: o } = await db.from('orientacoes_agente').insert({ titulo: TITULO, texto: c, tipo: 'regra', ativo: true }).select('id').single();
  const base = Date.now() - 60 * 60 * 1000;
  const versao = (acao: string, texto: string, min: number) => ({
    orientacao_id: o!.id, acao, titulo: TITULO, texto, tipo: 'regra', ativo: true, usuario_id: usuario, criado_em: new Date(base + min * 60_000).toISOString(),
  });
  await db.from('orientacoes_agente_versoes').insert([versao('criar', a!, 1), versao('editar', b!, 2), versao('editar', c!, 3)]);
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page, `?orientacao=${o!.id}`);

  const linhas = editor(page).getByRole('table', { name: 'Versões da orientação' }).locator('tbody tr');
  await expect(linhas).toHaveCount(3);
  // A mais antiga (Criou): restaurar traz o texto dela, não o da vizinha.
  await linhas.filter({ hasText: 'Criou' }).getByRole('button', { name: 'Restaurar esta versão' }).click();
  await page.getByRole('alertdialog').or(page.getByRole('dialog')).getByRole('button', { name: 'Restaurar', exact: true }).click();
  await expect.poll(async () => (await db.from('orientacoes_agente').select('texto').eq('id', o!.id).single()).data?.texto).toBe(a);
  expect((await db.from('orientacoes_agente').select('ativo').eq('id', o!.id).single()).data?.ativo).toBe(true);
  expect(await versoes(o!.id)).toEqual(['criar', 'editar', 'editar', 'restaurar']);
  await expect(editor(page).getByLabel('O que o agente deve fazer')).toHaveValue(a!);
});

test('teste retomado: sem selo do rascunho, sem "Sem o rascunho" e sem linha nova', async ({ page }) => {
  const usuario = await criarAna();
  const TITULO = `${P} Guia do DAS`;
  const { data: o } = await db.from('orientacoes_agente').insert({ titulo: TITULO, texto: 'Mande a guia em PDF.', tipo: 'situacao', ativo: false }).select('id').single();
  // Um teste pendente de antes (outra aba): o próximo pedido o retoma em vez de criar outro.
  const { data: antigo } = await db.from('simulacoes_agente').insert({ usuario_id: usuario, mensagem: 'Pergunta do teste antigo', status: 'pendente' }).select('id').single();
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page, `?orientacao=${o!.id}`);

  await editor(page).getByLabel('O que o agente deve fazer').fill('Mande a guia em PDF e o vencimento.');
  await simulador(page).getByLabel('Mensagem do cliente').fill('Cadê minha guia?');
  await simulador(page).getByRole('button', { name: 'Testar', exact: true }).click();
  await expect(simulador(page).getByText('Você já tem um teste em andamento')).toBeVisible();
  await expect(simulador(page).getByText('Pergunta do teste antigo')).toBeVisible();
  await expect(simulador(page).getByText('Teste com o rascunho')).toHaveCount(0);
  expect((await simulacoes(usuario)).map((s) => s.id)).toEqual([antigo!.id]);

  await pronta(antigo!.id, { mensagens: ['Resposta do teste antigo.'], acoes: [], observacoes: [] });
  await expect(simulador(page).getByText('Resposta do teste antigo.')).toBeVisible({ timeout: 10_000 });
  await expect(simulador(page).getByRole('region', { name: 'Sem o rascunho' })).toHaveCount(0);
  await expect(simulador(page).getByText('Teste com o rascunho')).toHaveCount(0);
  await expect(simulador(page).getByRole('button', { name: 'Testar', exact: true })).toBeEnabled();
  expect(await simulacoes(usuario)).toHaveLength(1);
});

test('ligar e salvar durante a comparação não prendem o Testar; Testar e Tentar de novo não criam teste enquanto um roda', async ({ page }) => {
  const usuario = await criarAna();
  const TITULO = `${P} Boleto vencido`;
  const { data: o } = await db.from('orientacoes_agente').insert({ titulo: TITULO, texto: 'Mande o boleto atualizado.', tipo: 'situacao', ativo: false }).select('id').single();
  await entrar(page, EMAIL, senha);
  await abrirTreinar(page, `?orientacao=${o!.id}`);
  const testar = simulador(page).getByRole('button', { name: 'Testar', exact: true });
  // Envia o formulário do simulador por fora do botão (desligado): só a regra "um teste por vez" da tela segura.
  const forcarEnvio = () => simulador(page).locator('form').evaluate((f: HTMLFormElement) => f.requestSubmit());

  const rascunho = 'Mande o boleto atualizado e avise que os juros são do banco.';
  await editor(page).getByLabel('O que o agente deve fazer').fill(rascunho);
  await simulador(page).getByLabel('Mensagem do cliente').fill('Meu boleto venceu.');
  await testar.click();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(1);
  await expect(testar).toBeDisabled();
  await forcarEnvio();
  await page.waitForLoadState('networkidle');
  expect(await simulacoes(usuario)).toHaveLength(1);
  const [primeira] = await simulacoes(usuario);
  await pronta(primeira!.id, { mensagens: ['Segue o boleto atualizado.'], acoes: [], observacoes: [] });
  await expect(simulador(page).getByText('Segue o boleto atualizado.')).toBeVisible({ timeout: 10_000 });

  // Comparação em "Pensando…": ligar pelo alto e salvar não somem com o quadro nem deixam o Testar preso.
  const sem = simulador(page).getByRole('region', { name: 'Sem o rascunho' });
  await sem.getByRole('button', { name: 'Comparar sem o rascunho' }).click();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(2);
  await expect(sem.getByText('Pensando…')).toBeVisible();
  await editor(page).getByRole('switch', { name: `Ligar a orientação ${TITULO}` }).click();
  await expect.poll(async () => (await db.from('orientacoes_agente').select('ativo').eq('id', o!.id).single()).data?.ativo).toBe(true);
  await expect(editor(page).getByRole('switch', { name: `Desligar a orientação ${TITULO}` })).toBeEnabled();
  await editor(page).getByRole('button', { name: 'Salvar e ligar' }).click();
  await expect.poll(async () => (await db.from('orientacoes_agente').select('texto').eq('id', o!.id).single()).data?.texto).toBe(rascunho);
  await expect(sem.getByText('Pensando…')).toBeVisible();
  await expect(testar).toBeDisabled();
  const segunda = (await simulacoes(usuario))[1]!;
  await pronta(segunda.id, { mensagens: ['Qual o número do boleto?'], acoes: [], observacoes: [] });
  await expect(sem.getByText('Qual o número do boleto?')).toBeVisible({ timeout: 10_000 });
  await expect(testar).toBeEnabled();

  // Teste com erro: "Tentar de novo" cria um só teste novo, e nada mais sai enquanto ele roda.
  await simulador(page).getByLabel('Mensagem do cliente').fill('E a segunda via?');
  await testar.click();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(3);
  const terceira = (await simulacoes(usuario))[2]!;
  await db.from('simulacoes_agente').update({ status: 'erro', erro: 'Falhou no teste.' }).eq('id', terceira.id);
  const tentar = simulador(page).getByRole('button', { name: 'Tentar de novo' });
  await expect(tentar).toBeVisible({ timeout: 10_000 });
  await tentar.dblclick();
  await expect.poll(async () => (await simulacoes(usuario)).length).toBe(4);
  await expect(simulador(page).getByRole('status').filter({ hasText: 'Pensando…' })).toBeVisible();
  await expect(testar).toBeDisabled();
  await forcarEnvio();
  await page.waitForLoadState('networkidle');
  expect(await simulacoes(usuario)).toHaveLength(4);
  const quarta = (await simulacoes(usuario))[3]!;
  expect(quarta).toMatchObject({ mensagem: 'E a segunda via?', status: 'pendente' });
  await pronta(quarta.id, { mensagens: ['Segue a segunda via.'], acoes: [], observacoes: [] });
  await expect(testar).toBeEnabled({ timeout: 10_000 });
});
