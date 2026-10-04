import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';
import { abrirInicio, cartaoNumero, demandaPausadaE2e, fimDeHoje, numeroInicio } from './apoio-inicio';

const SENHA = 'senha-forte-123';
const P = 'E2E-G2M';
const ANA = { email: 'ana-mesa@e2e.local', nome: 'Ana Mesa' };
let ana = '';

test.beforeEach(async () => {
  await limparDemandasE2e(P);
  ana = await criarUsuarioTeste({ email: ANA.email, senha: SENHA, nome: ANA.nome, papel: 'atendente', setores: ['Fiscal'] });
});
test.afterAll(() => limparDemandasE2e(P));

test('Minha mesa: saudação, setores, números iguais aos grupos e ABRIR no painel da demanda', async ({ page }) => {
  const vencida = await demandaE2e({ titulo: `${P} vencida`, setor: 'Fiscal', status: 'em_andamento', prioridade: 'alta', responsavelId: ana, prazoEm: '2020-01-02T21:00:00Z' });
  await demandaE2e({ titulo: `${P} hoje`, setor: 'Fiscal', status: 'em_andamento', prioridade: 'urgente', responsavelId: ana, prazoEm: fimDeHoje() });
  await demandaE2e({ titulo: `${P} depois`, setor: 'Fiscal', responsavelId: ana, prazoEm: new Date(Date.now() + 5 * 86_400_000).toISOString() });
  await demandaPausadaE2e({ titulo: `${P} com o cliente`, setor: 'Fiscal', responsavelId: ana, prazoEm: '2020-01-02T21:00:00Z' });
  // De outra pessoa no mesmo setor: não é "minha".
  const bruno = await criarUsuarioTeste({ email: 'bruno-mesa@e2e.local', senha: SENHA, nome: 'Bruno Mesa', papel: 'atendente', setores: ['Fiscal'] });
  await demandaE2e({ titulo: `${P} de outra pessoa`, setor: 'Fiscal', status: 'em_andamento', prazoEm: fimDeHoje(), responsavelId: bruno });

  await entrar(page, ANA.email, SENHA);
  await abrirInicio(page, 'mesa');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^(Bom dia|Boa tarde|Boa noite), Ana$/);
  await expect(page.getByText(/· seus setores: Fiscal$/)).toBeVisible();
  expect(await numeroInicio(page, 'minhas-vencidas')).toBe(1);
  expect(await numeroInicio(page, 'vencem-hoje')).toBe(1);
  await expect(cartaoNumero(page, 'minhas-vencidas')).toContainText('minha demanda vencida');

  const minhas = page.getByRole('region', { name: 'Minhas demandas por prazo' });
  await expect(minhas).toContainText('4 comigo · ordenadas pelo que vence primeiro');
  await expect(minhas.getByRole('list', { name: /^Vencida/ })).toContainText(`${P} vencida`);
  await expect(minhas.getByRole('list', { name: /^Vencem hoje/ })).toContainText(`${P} hoje`);
  const proximos = minhas.getByRole('list', { name: /^Próximos dias/ });
  await expect(proximos).toContainText(`${P} depois`);
  await expect(proximos.getByRole('listitem').filter({ hasText: `${P} com o cliente` })).toContainText('pausado');
  await expect(minhas).not.toContainText(`${P} de outra pessoa`);

  // O número leva ao grupo na própria página (D11).
  await expect(cartaoNumero(page, 'minhas-vencidas').getByRole('link')).toHaveAttribute('href', '#vencidas');

  const abrir = minhas.getByRole('link', { name: `Abrir a demanda #${vencida.numero}` });
  await expect(abrir).toHaveAttribute('href', `/demandas?demanda=${vencida.id}`);
  await abrir.click();
  await expect(page.getByRole('dialog', { name: new RegExp(`Nº ${vencida.numero}`) })).toBeVisible({ timeout: 30_000 });
});

test('CONCLUIR pede confirmação, tira a demanda da mesa e conta em "Você concluiu"', async ({ page }) => {
  const d = await demandaE2e({ titulo: `${P} concluir`, setor: 'Fiscal', status: 'em_andamento', responsavelId: ana, prazoEm: fimDeHoje() });
  await entrar(page, ANA.email, SENHA);
  await abrirInicio(page, 'mesa');
  const minhas = page.getByRole('region', { name: 'Minhas demandas por prazo' });
  await expect(minhas).toContainText('Você ainda não concluiu demandas hoje.');
  await minhas.getByRole('button', { name: `Concluir a demanda #${d.numero}` }).click();
  const janela = page.getByRole('dialog');
  await expect(janela).toContainText(`Concluir a demanda #${d.numero}?`);
  await janela.getByRole('button', { name: 'Concluir' }).click();
  await expect(page.getByText('Demanda concluída.')).toBeVisible();
  await expect(minhas).not.toContainText(`${P} concluir`);
  await expect(minhas).toContainText('Você concluiu 1 demanda hoje.');
  expect((await db.from('chamados').select('status').eq('id', d.id).single()).data?.status).toBe('concluido');
});

const PREFIXO_TEL = '553197004';

test('Sem responsável nos meus setores: só do setor dela, ASSUMIR leva para as minhas', async ({ page }) => {
  const fiscal = await demandaE2e({ titulo: `${P} sem resp Fiscal`, setor: 'Fiscal', prazoEm: fimDeHoje() });
  await demandaE2e({ titulo: `${P} sem resp Pessoal`, setor: 'Pessoal', prazoEm: fimDeHoje() });
  await entrar(page, ANA.email, SENHA);
  await abrirInicio(page, 'mesa');
  const sem = page.getByRole('region', { name: 'Sem responsável nos meus setores' });
  await expect(sem).toContainText(`${P} sem resp Fiscal`);
  await expect(sem).not.toContainText(`${P} sem resp Pessoal`);
  await sem.getByRole('button', { name: `Assumir a demanda #${fiscal.numero}` }).click();
  await expect(page.getByText('Demanda assumida.')).toBeVisible();
  await expect(sem).not.toContainText(`${P} sem resp Fiscal`);
  await expect(page.getByRole('region', { name: 'Minhas demandas por prazo' })).toContainText(`${P} sem resp Fiscal`);
});

test('ASSUMIR de uma demanda que outra pessoa pegou antes: o aviso do banco e nada muda', async ({ page }) => {
  const d = await demandaE2e({ titulo: `${P} disputada`, setor: 'Fiscal', prazoEm: fimDeHoje() });
  const bruno = await criarUsuarioTeste({ email: 'bruno-mesa@e2e.local', senha: SENHA, nome: 'Bruno Mesa', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, ANA.email, SENHA);
  await abrirInicio(page, 'mesa');
  await db.from('chamados').update({ responsavel_id: bruno }).eq('id', d.id);
  await page.getByRole('button', { name: `Assumir a demanda #${d.numero}` }).click();
  await expect(page.getByText('A demanda já está com Bruno Mesa.')).toBeVisible();
  expect((await db.from('chamados').select('responsavel_id').eq('id', d.id).single()).data?.responsavel_id).toBe(bruno);
});

test('"Só as minhas": a seção sem responsável fica vazia (a regra de leitura vale)', async ({ page }) => {
  await demandaE2e({ titulo: `${P} sem resp oculta`, setor: 'Fiscal', prazoEm: fimDeHoje() });
  await db.from('usuario_permissoes').update({ nivel: 'minhas' }).eq('usuario_id', ana).eq('modulo', 'demandas');
  await entrar(page, ANA.email, SENHA);
  await abrirInicio(page, 'mesa');
  const sem = page.getByRole('region', { name: 'Sem responsável nos meus setores' });
  await expect(sem).toContainText('Nenhuma demanda sem responsável nos seus setores.');
  expect(await numeroInicio(page, 'sem-responsavel')).toBe(0);
});

test('conversas esperando você (cronômetro e não lidas), atalhos e o bloco Sistema sem pausar nem gasto', async ({ page }) => {
  await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
  await db.from('configuracoes').update({ agente_pausado: false }).eq('id', 1);
  const { data: setor } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  const { data: c } = await db.from('conversas').insert({
    telefone: `${PREFIXO_TEL}0001`, aguardando_pessoa_desde: new Date(Date.now() - 7 * 60_000).toISOString(), motivo_pessoa: 'pediu para falar com pessoa',
  }).select('id').single();
  await db.from('chamados').insert({ conversa_id: c!.id, setor_id: setor!.id, titulo: `${P} da conversa` });
  for (const [i, texto] of ['um', 'dois', 'três'].entries()) {
    await db.from('mensagens').insert({ conversa_id: c!.id, direcao: 'entrada', autor: 'cliente', conteudo: texto,
      criado_em: new Date(Date.now() - (3 - i) * 1000).toISOString(), processada_em: new Date().toISOString() });
  }
  try {
    await entrar(page, ANA.email, SENHA);
    await abrirInicio(page, 'mesa');
    const conversas = page.getByRole('region', { name: 'Conversas esperando você' });
    const item = conversas.locator(`a[href="/atendimento/${c!.id}"]`);
    await expect(item.locator('[data-espera="ambar"]')).toContainText('7 min');
    await expect(item.getByLabel('3 mensagens não lidas')).toBeVisible();
    await expect(conversas).toContainText(/com o agente hoje/);
    await expect(conversas.getByRole('link', { name: 'Abrir atendimento' })).toHaveAttribute('href', '/atendimento');

    const atalhos = page.getByRole('navigation', { name: 'Atalhos' });
    await expect(atalhos.getByRole('link', { name: 'Nova demanda' })).toHaveAttribute('href', '/demandas?nova=1');
    await expect(atalhos.getByRole('link', { name: 'Contatos' })).toHaveAttribute('href', '/contatos');
    await expect(atalhos.getByRole('link', { name: 'Respostas prontas' })).toHaveCount(0);

    const sistema = page.getByTestId('inicio-sistema');
    await expect(sistema.locator('[data-sistema="agente"]')).toContainText('atendendo');
    await expect(sistema.locator('[data-sistema="whatsapp"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Pausar agente|Retomar agente/ })).toHaveCount(0);
    await expect(page.getByText('US$')).toHaveCount(0);
  } finally {
    await db.from('conversas').delete().like('telefone', `${PREFIXO_TEL}%`);
  }
});
