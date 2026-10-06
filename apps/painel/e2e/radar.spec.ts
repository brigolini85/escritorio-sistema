import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { configRadarTeste, limparBanco, sqlTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste, entrar } from './apoio';
import { SENHA, TITULO_ALTA, TITULO_BAIXA, prepararRadar } from './apoio-radar';

// Parte I5 (spec 7E, D18): a Visão geral do Radar de legislação.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

const cartao = (page: Page, titulo: string) => page.getByTestId('novidade').filter({ hasText: titulo });
const aba = (page: Page, nome: RegExp) => page.getByRole('navigation', { name: 'Novidades' }).getByRole('link', { name: nome });

async function entrarComoDono(page: Page) {
  const r = await prepararRadar();
  await entrar(page, 'dono@agentes.local', SENHA);
  await page.goto('/agentes/radar');
  await expect(page.getByTestId('radar-cabecalho')).toBeVisible();
  return r;
}

test('dono abre o Radar: cabeçalho, faixa do giro, novidades por impacto, selos, fontes, assuntos, avisos; sem violações de acessibilidade', async ({ page }) => {
  await entrarComoDono(page);
  const cab = page.getByTestId('radar-cabecalho');
  await expect(cab.getByRole('heading', { name: 'Radar de legislação' })).toBeVisible();
  await expect(cab.getByText('Só sugere, não altera nada')).toBeVisible();
  await expect(page.getByTestId('radar-faixa-giro')).toContainText('CONFAZ fora do ar');
  await expect(page.getByTestId('novidade')).toHaveCount(3);
  expect(await page.getByTestId('novidade').evaluateAll((l) => l.map((e) => e.getAttribute('data-impacto')))).toEqual(['alto', 'medio', 'baixo']);
  await expect(cartao(page, TITULO_ALTA).getByText('oficial', { exact: true })).toBeVisible();
  await expect(cartao(page, TITULO_BAIXA).getByText('confirmar', { exact: true })).toBeVisible();
  await expect(page.getByTestId('radar-fontes').getByRole('listitem')).toHaveCount(9);
  await expect(page.getByRole('heading', { name: 'Assuntos vigiados' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Avisos' })).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});

test('filtros: viraram demanda vazio, setor, impacto e busca', async ({ page }) => {
  await entrarComoDono(page);
  await aba(page, /Viraram demanda\s*0/).click();
  await expect(page.getByTestId('novidades-vazia')).toHaveText('Nenhuma novidade virou demanda.');
  await page.goto('/agentes/radar');
  await page.getByRole('combobox', { name: 'Setor' }).click();
  await page.getByRole('option', { name: 'Fiscal' }).click();
  await expect(page.getByTestId('novidade')).toHaveCount(2);
  await page.goto('/agentes/radar');
  await page.getByRole('combobox', { name: 'Impacto' }).click();
  await page.getByRole('option', { name: 'Impacto alto' }).click();
  await expect(page.getByTestId('novidade')).toHaveCount(1);
  await expect(cartao(page, TITULO_ALTA)).toBeVisible();
  await page.goto('/agentes/radar');
  await page.getByLabel('Buscar novidade').fill('leiaute');
  await page.getByLabel('Buscar novidade').press('Enter');
  await expect(page.getByTestId('novidade')).toHaveCount(1);
  await expect(cartao(page, TITULO_ALTA)).toBeVisible();
});

test('criar demanda no setor Pessoal (Paula, que treina): toast, sai de Para decidir e vira demanda sem empresa', async ({ page }) => {
  await prepararRadar();
  await criarUsuarioTeste({ email: 'paula@agentes.local', senha: SENHA, nome: 'Paula', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Pessoal'] });
  await entrar(page, 'paula@agentes.local', SENHA);
  await page.goto('/agentes/radar');
  const alta = cartao(page, TITULO_ALTA);
  await alta.getByRole('button', { name: 'Escolher o setor da demanda' }).click();
  await page.getByRole('menuitemradio', { name: 'Pessoal' }).click();
  await alta.getByRole('button', { name: 'Criar demanda · Pessoal' }).click();
  await expect(page.getByText(/Demanda #\d+ criada\./)).toBeVisible();
  await expect(page.locator('[data-estado="para_decidir"]')).toHaveCount(2);
  await aba(page, /Viraram demanda\s*1/).click();
  await expect(page.getByTestId('novidade').first()).toContainText(/Virou demanda #\d+ · Pessoal · por Paula/);
  const d = await sqlTeste<{ titulo: string; cliente_id: string | null; setor: string }>(
    `select c.titulo, c.cliente_id, s.nome as setor from public.chamados c join public.setores s on s.id = c.setor_id where c.titulo like 'Radar:%'`);
  expect(d).toHaveLength(1);
  expect(d[0]).toMatchObject({ cliente_id: null, setor: 'Pessoal' });
  expect(d[0]!.titulo).toContain(TITULO_ALTA);
});

test('avisar equipe: um alerta por setor; de novo, "já foi avisada há pouco"', async ({ page }) => {
  await entrarComoDono(page);
  const alta = cartao(page, TITULO_ALTA);
  await alta.getByRole('button', { name: 'Avisar equipe' }).click();
  await expect(page.getByText('Equipe avisada.')).toBeVisible();
  const a = await sqlTeste<{ setor: string }>(`select s.nome as setor from public.alertas a join public.setores s on s.id = a.setor_id where a.mensagem like 'Radar:%' order by 1`);
  expect(a.map((x) => x.setor)).toEqual(['Contábil', 'Pessoal']);
  await alta.getByRole('button', { name: 'Avisar equipe' }).click();
  await expect(page.getByText('A equipe já foi avisada há pouco.')).toBeVisible();
  expect(await sqlTeste(`select 1 from public.alertas where mensagem like 'Radar:%'`)).toHaveLength(2);
});

test('descartar pede confirmação e leva a novidade para Descartadas', async ({ page }) => {
  await entrarComoDono(page);
  await cartao(page, TITULO_BAIXA).getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page.getByRole('dialog').getByText('Descartar esta novidade?')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Descartar', exact: true }).click();
  await expect(page.getByText('Novidade descartada.')).toBeVisible();
  await expect(page.getByTestId('novidade')).toHaveCount(2);
  await aba(page, /Descartadas\s*1/).click();
  await expect(page.getByTestId('novidade').first()).toContainText(/Descartada por Thiago Dono/);
  expect(await sqlTeste<{ estado: string }>('select estado from public.radar_novidades where titulo = $1', [TITULO_BAIXA])).toEqual([{ estado: 'descartada' }]);
});

test('procurar agora pede um giro (só um por vez); quem não treina não vê o Radar', async ({ page }) => {
  await entrarComoDono(page);
  const botao = page.getByRole('button', { name: 'Procurar agora' });
  await botao.click();
  await expect(page.getByText('Giro pedido. Começa em até 1 minuto.').first()).toBeVisible();
  await expect.poll(async () => (await sqlTeste(`select 1 from public.radar_giros where estado = 'pendente'`)).length).toBe(1);
  await expect(botao).toBeDisabled();
  await expect(page.getByText('Já tem um giro em andamento.')).toBeVisible();
  await page.context().clearCookies();
  await criarUsuarioTeste({ email: 'rui@agentes.local', senha: SENHA, nome: 'Rui', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'rui@agentes.local', SENHA);
  await expect(page.getByRole('link', { name: 'Agentes' })).toHaveCount(0);
  await page.goto('/agentes/radar');
  await expect(page.getByText('Você não tem acesso a esta tela.')).toBeVisible();
  await expect(page.getByTestId('radar-cabecalho')).toHaveCount(0);
});

test('administrador que não é dono: só lê o que é do dono, mas pede giro', async ({ page }) => {
  await prepararRadar();
  await criarUsuarioTeste({ email: 'admin@radar.local', senha: SENHA, nome: 'Admin', papel: 'admin' });
  await entrar(page, 'admin@radar.local', SENHA);
  await page.goto('/agentes/radar');
  await expect(page.getByTestId('radar-cabecalho')).toBeVisible();
  await expect(page.getByRole('switch', { name: 'Radar ligado' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mudar' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar fonte' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Tirar .* das fontes$/ })).toHaveCount(0);
  for (const nome of ['Resumo diário no WhatsApp do dono', 'Impacto alto avisa na hora', 'Avisar equipe pelo painel']) {
    await expect(page.getByRole('switch', { name: nome })).toBeDisabled();
  }
  expect(await page.getByText('só o dono').count()).toBeGreaterThanOrEqual(4);
  await page.getByRole('button', { name: 'Procurar agora' }).click();
  await expect(page.getByText('Giro pedido. Começa em até 1 minuto.').first()).toBeVisible();
});

test('dono: adiciona e tira fonte, muda a agenda e desliga o resumo diário', async ({ page }) => {
  await entrarComoDono(page);
  await configRadarTeste({ resumo_whatsapp: true });
  await page.reload();
  const fontes = page.getByTestId('radar-fontes');
  await page.getByRole('button', { name: 'Adicionar fonte' }).click();
  const j = page.getByRole('dialog');
  await j.getByLabel('Nome', { exact: true }).fill('Contábeis');
  await j.getByLabel('Endereço').fill('intranet');
  await j.getByRole('button', { name: 'Adicionar fonte' }).click();
  await expect(j.getByRole('alert').first()).toBeVisible();
  await expect(j.getByLabel('Endereço')).toHaveAttribute('aria-invalid', 'true');
  await j.getByLabel('Endereço').fill('https://www.contabeis.com.br/noticias');
  await j.getByRole('switch', { name: 'Fonte oficial' }).click();
  await j.getByRole('button', { name: 'Adicionar fonte' }).click();
  await expect(page.getByText('Fonte adicionada.')).toBeVisible();
  await expect(fontes.getByRole('listitem')).toHaveCount(10);
  await expect(fontes.getByRole('listitem').filter({ hasText: 'Contábeis' })).toContainText('notícias');
  expect(await sqlTeste(`select 1 from public.radar_fontes where nome = 'Contábeis' and oficial = false`)).toHaveLength(1);
  await page.getByRole('button', { name: 'Tirar Contábeis das fontes' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tirar fonte' }).click();
  await expect(page.getByText('Contábeis saiu das fontes.')).toBeVisible();
  await expect(fontes.getByRole('listitem')).toHaveCount(9);

  await page.getByTestId('radar-cabecalho').getByRole('button', { name: 'Mudar' }).click();
  const ag = page.getByRole('dialog');
  await ag.getByLabel('Hora').fill('07:30');
  await ag.getByRole('button', { name: 'Dias úteis' }).click();
  await ag.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Agenda salva.')).toBeVisible();
  await expect(page.getByTestId('radar-cabecalho')).toContainText('dias úteis, 7h30');

  await page.getByRole('switch', { name: 'Resumo diário no WhatsApp do dono' }).click();
  await expect.poll(async () => (await sqlTeste<{ r: boolean }>('select resumo_whatsapp as r from public.radar_config where id = 1'))[0]!.r).toBe(false);
});
