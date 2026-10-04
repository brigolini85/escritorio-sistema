import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, limparDemandasE2e } from './apoio-demandas';
import { abrirSecao } from './apoio-configuracoes';

const SENHA = 'senha-forte-123';
const PREFIXO = 'G1 impacto';
const mesmoInstante = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

test.afterEach(async () => {
  await db.from('configuracoes').update({ prazo_normal_dias: 2 }).eq('id', 1);
  await limparDemandasE2e(PREFIXO);
});

test('Prazos: janela de impacto, padrão "Só para as novas" e aplicar às abertas com evento na linha do tempo', async ({ page }) => {
  await db.from('configuracoes').update({ prazo_normal_dias: 2 }).eq('id', 1);
  // Segundos inteiros: o evento guarda o prazo com texto_prazo (sem milissegundos), como todo prazo do painel.
  const longe = new Date(Math.floor((Date.now() + 40 * 86_400_000) / 1000) * 1000).toISOString();
  const a = await demandaE2e({ titulo: `${PREFIXO} A`, setor: 'Fiscal', prioridade: 'normal', prazoEm: longe });
  await demandaE2e({ titulo: `${PREFIXO} perto`, setor: 'Fiscal', prioridade: 'normal', prazoEm: new Date(Date.now() + 3_600_000).toISOString() });
  const { count } = await db.from('chamados').select('id', { count: 'exact', head: true }).eq('prioridade', 'normal').neq('status', 'concluido');
  await criarUsuarioTeste({ email: 'admin-impacto@e2e.local', senha: SENHA, nome: 'Admin Impacto', papel: 'admin' });
  await entrar(page, 'admin-impacto@e2e.local', SENHA);

  // 2 → 3, Enter: o foco está em "Só para as novas".
  await abrirSecao(page, 'prazos');
  const cartao = page.getByRole('region', { name: 'Prazos por prioridade' });
  await cartao.getByLabel('Normal (dias úteis)').fill('3', { timeout: 30_000 });
  await cartao.getByRole('button', { name: 'Salvar prazos' }).click();
  const janela = page.getByRole('dialog', { name: 'Mudar o prazo das demandas abertas também?' });
  await expect(janela.getByText(`${count} demandas Normais abertas`)).toBeVisible({ timeout: 30_000 });
  await expect(janela.getByText('Nenhuma fica vencida.')).toBeVisible();
  await expect(janela.getByRole('button', { name: 'Só para as novas' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Prazos salvos. Valem para as demandas novas.')).toBeVisible();
  expect((await db.from('configuracoes').select('prazo_normal_dias').eq('id', 1).single()).data?.prazo_normal_dias).toBe(3);
  expect(mesmoInstante((await db.from('chamados').select('prazo_em').eq('id', a.id).single()).data!.prazo_em!, longe)).toBe(true);
  expect((await db.from('chamado_eventos').select('id').eq('chamado_id', a.id).eq('tipo', 'prazo_recalculado')).data).toHaveLength(0);

  // Esc fecha sem salvar e mantém o digitado.
  await cartao.getByLabel('Normal (dias úteis)').fill('1');
  await cartao.getByRole('button', { name: 'Salvar prazos' }).click();
  await expect(janela).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(janela).toHaveCount(0);
  await expect(cartao.getByLabel('Normal (dias úteis)')).toHaveValue('1');
  expect((await db.from('configuracoes').select('prazo_normal_dias').eq('id', 1).single()).data?.prazo_normal_dias).toBe(3);

  // 3 → 1 e aplicar: aviso vermelho (a "perto" venceria), A perde 2 dias úteis e ganha o evento.
  await cartao.getByRole('button', { name: 'Salvar prazos' }).click();
  await expect(janela.getByRole('alert')).toContainText(/passaria(m)? a vencida/);
  await janela.getByRole('button', { name: /^Aplicar também à/ }).click();
  await expect(page.getByText(/^Prazos salvos e aplicados/)).toBeVisible();
  const depois = (await db.from('chamados').select('prazo_em').eq('id', a.id).single()).data!.prazo_em!;
  expect(new Date(depois).getTime()).toBeLessThan(new Date(longe).getTime());
  const { data: eventos } = await db.from('chamado_eventos').select('texto').eq('chamado_id', a.id).eq('tipo', 'prazo_recalculado');
  expect(eventos).toHaveLength(1);
  expect(mesmoInstante(eventos![0]!.texto!, depois)).toBe(true);

  await page.goto(`/demandas?demanda=${a.id}`);
  await expect(page.getByText(/recalculado por mudança de regra \(Admin Impacto\)/)).toBeVisible({ timeout: 30_000 });
});
