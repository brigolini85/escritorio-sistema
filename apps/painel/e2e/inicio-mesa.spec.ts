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
