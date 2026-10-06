import { expect, test } from '@playwright/test';
import { configurarAgenteTeste, criarSkillTeste, limparBanco, sqlTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste, entrar } from './apoio';
import { SENHA } from './apoio-agentes';
import { demandaE2e, empresaE2e } from './apoio-demandas';
import { cenarioTarefa } from './apoio-tarefas';

// Parte I3a (D3, D21): a tarefa no painel lateral da demanda e o pedido pelo botão.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

test('demanda sem tarefa: Cláudia pede ao Agente Contábil com o procedimento e cai na página da tarefa', async ({ page }) => {
  const empresa = await empresaE2e('I3 Padaria Sol', '21448390000190');
  const d = await demandaE2e({ titulo: 'I3 Fechamento de outubro', setor: 'Contábil', clienteId: empresa });
  await configurarAgenteTeste('contabil', { estado: 'ligado' });
  await criarSkillTeste('contabil', 'fechamento-mensal', 'procedimento', true, [], { titulo: 'Fechamento mensal', descricao: 'Fechar o mês.', corpo: '## Etapas\n1. Coletar' });
  await criarUsuarioTeste({ email: 'claudia@i3.local', senha: SENHA, nome: 'Cláudia Contábil', papel: 'atendente', setores: ['Contábil'] });
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/demandas?demanda=${d.id}`);
  await page.getByRole('button', { name: 'Tarefa para o agente' }).click();
  await expect(page.getByLabel('Agente', { exact: true })).toHaveText(/Agente Contábil/);
  await page.getByLabel('Procedimento').selectOption('fechamento-mensal');
  await page.getByLabel('O que o agente deve fazer?').fill('Fazer o fechamento de outubro');
  await page.getByRole('button', { name: 'Pedir ao agente' }).click();
  await page.waitForURL('**/tarefas/**');
  const [t] = await sqlTeste<{ estado: string; skill_nome: string; canal: string }>('select estado, skill_nome, canal from public.agente_tarefas');
  expect(t).toEqual({ estado: 'trabalhando', skill_nome: 'fechamento-mensal', canal: 'painel' });
});

test('demanda com tarefa ativa: o bloco mostra o estado, as pendências e "Abrir a tarefa"; sem botão de nova', async ({ page }) => {
  const c = await cenarioTarefa({ pendencias: [{ tipo: 'analista', pergunta: 'Qual conta?' }] });
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/demandas?demanda=${c.demanda.id}`);
  await expect(page.getByText('Aguardando pendências')).toBeVisible();
  await expect(page.getByText('1 pendência aberta')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abrir a tarefa' })).toHaveAttribute('href', `/tarefas/${c.tarefa.id}`);
  await expect(page.getByRole('button', { name: 'Tarefa para o agente' })).toHaveCount(0);
});

test('agente em Teste: quem não é dono nem administrador não vê o botão de pedir tarefa', async ({ page }) => {
  const empresa = await empresaE2e('I3 Padaria Sol', '21448390000190');
  const d = await demandaE2e({ titulo: 'I3 Fechamento de outubro', setor: 'Contábil', clienteId: empresa });
  await configurarAgenteTeste('contabil', { estado: 'teste' });
  await criarUsuarioTeste({ email: 'claudia@i3.local', senha: SENHA, nome: 'Cláudia Contábil', papel: 'atendente', setores: ['Contábil'] });
  await entrar(page, 'claudia@i3.local', SENHA);
  await page.goto(`/demandas?demanda=${d.id}`);
  // Task 14 (9bd17a8): o botão só aparece quando algum agente aceita o pedido; em Teste, para quem não é dono/admin, nenhum aceita.
  await expect(page.getByText('I3 Fechamento de outubro').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tarefa para o agente' })).toHaveCount(0);
});
