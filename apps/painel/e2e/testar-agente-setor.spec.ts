import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { criarTarefaTeste, limparBanco } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA, abrirAgente, criarDono, skillNoBanco } from './apoio-agentes';
import { demandaE2e, empresaE2e } from './apoio-demandas';
import { esperarTreinar } from './apoio-treinar';

// Parte I3b (spec 7E.1; D11, D13, D16): Testar dos agentes dos setores, o ▷ das skills e o cartão com tarefas aguardando aprovação.
// Nos e2e não roda trabalhador: confere-se só a criação da simulação e o "Pensando…" na tela.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

const simulador = (page: import('@playwright/test').Page) => page.getByRole('region', { name: 'Simulador', exact: true });
const idDe = async (slug: string) => (await db.from('agentes').select('id').eq('slug', slug).single()).data!.id;
const simulacoes = async (usuarioId: string) =>
  (await db.from('simulacoes_agente').select('agente_id, modo, status, skill_id, mensagem').eq('usuario_id', usuarioId).order('criado_em')).data ?? [];

test('Fiscal (Conversa): Ana escolhe o modo, testa e a simulação nasce com o agente e o modo', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana@i3.local', senha: SENHA, nome: 'Ana Fiscal', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Fiscal'] });
  await entrar(page, 'ana@i3.local', SENHA);
  await abrirAgente(page, 'fiscal', 'testar');
  await esperarTreinar(page);
  await expect(page.getByText(/Escreva como cliente e veja o que o agente responderia no modo escolhido/)).toBeVisible();
  const janela = simulador(page);
  const modo = janela.getByLabel('Modo de falar com o cliente');
  await expect(modo).toHaveValue('por_tras');
  await expect(modo.locator('option:checked')).toHaveText(/\(padrão\)/);
  await modo.selectOption('por_tras');
  await janela.getByLabel('Mensagem do cliente').fill('Saiu a nota do pedido 4512?');
  await janela.getByRole('button', { name: 'Testar', exact: true }).click();
  await expect(janela.getByRole('status').filter({ hasText: 'Pensando…' })).toBeVisible();
  await expect.poll(async () => (await simulacoes(ana)).length).toBe(1);
  expect((await simulacoes(ana))[0]).toMatchObject({ agente_id: await idDe('fiscal'), modo: 'por_tras', status: 'pendente', skill_id: null, mensagem: 'Saiu a nota do pedido 4512?' });
});

test('Paula (Pessoal) não testa o Fiscal', async ({ page }) => {
  await criarUsuarioTeste({ email: 'paula@i3.local', senha: SENHA, nome: 'Paula Pessoal', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Pessoal'] });
  await entrar(page, 'paula@i3.local', SENHA);
  await abrirAgente(page, 'fiscal', 'testar');
  await expect(page.getByText('Você não tem acesso a esta tela.')).toBeVisible();
  await expect(simulador(page)).toHaveCount(0);
});

test('Contábil (só Trabalho): explica como testar e o "Testar agora" do cabeçalho fica desligado', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'contabil', 'testar');
  await expect(page.getByText(/Agente de trabalho: para testar, deixe-o em Teste e peça uma tarefa numa demanda de teste/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Testar agora' })).toBeDisabled();
});

test('▷ da skill do Fiscal (dono): abre o Testar com a skill desligada e a simulação guarda a skill e o agente', async ({ page }) => {
  const dono = await criarDono();
  const skill = await skillNoBanco('fiscal', { nome: 'tabela-cfop', tipo: 'conhecimento', titulo: 'Tabela CFOP', corpo: 'x', ativo: false });
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal', 'skills');
  await page.getByRole('link', { name: 'Testar Tabela CFOP' }).click();
  await expect(page).toHaveURL(new RegExp(`/agentes/fiscal/testar\\?skill=${skill}$`));
  await expect(page.getByText('Testando com a skill Tabela CFOP (desligada).')).toBeVisible();
  await esperarTreinar(page);
  const janela = simulador(page);
  await janela.getByLabel('Mensagem do cliente').fill('Qual o CFOP da venda?');
  await janela.getByRole('button', { name: 'Testar', exact: true }).click();
  await expect.poll(async () => (await simulacoes(dono)).length).toBe(1);
  expect((await simulacoes(dono))[0]).toMatchObject({ agente_id: await idDe('fiscal'), skill_id: skill, status: 'pendente' });
});

test('orientações do Fiscal: o simulador aparece ao lado do editor, com o mesmo botão Testar', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal', 'orientacoes?orientacao=nova');
  await esperarTreinar(page);
  await expect(page.getByRole('region', { name: 'Editor da orientação', exact: true })).toBeVisible();
  await expect(simulador(page).getByRole('button', { name: 'Testar', exact: true })).toBeVisible();
});

test('cartão do Contábil: "1 tarefa aguardando aprovação" e REVISAR abre a tarefa', async ({ page }) => {
  const empresa = await empresaE2e('I3 Padaria Sol', '21448390000190');
  const d = await demandaE2e({ titulo: 'I3 Fechamento de outubro', setor: 'Contábil', clienteId: empresa });
  const dono = await criarDono();
  const t = await criarTarefaTeste({ chamadoId: d.id, pedidaPor: dono, pedido: 'Fechar outubro', estado: 'pronta', etapas: ['Ler', 'Aprovação'],
    resultado: { versao: 1, resumo: 'Pronto.', destaques: [], linhas: [], observacoes: null } });
  await entrar(page, 'dono@agentes.local', SENHA);
  await page.goto('/agentes');
  await expect(page.getByText('1 tarefa aguardando aprovação')).toBeVisible();
  await page.getByRole('link', { name: 'Revisar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/tarefas/${t.id}$`));
});

test('acessibilidade: /agentes/fiscal/testar sem violações', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal', 'testar');
  await esperarTreinar(page);
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(a11y.violations).toEqual([]);
});
