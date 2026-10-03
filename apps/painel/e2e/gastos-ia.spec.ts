import { expect, test } from '@playwright/test';
import { db, entrar } from './apoio';
import { limparGastos, semearGastos } from './apoio-gastos';

let dados: Awaited<ReturnType<typeof semearGastos>>;
test.beforeAll(async () => { dados = await semearGastos(); });
test.afterAll(async () => { await limparGastos(); });

test('administrador vê o mês: cartões, por funcionalidade e por dia', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.getByRole('link', { name: 'Gastos com IA' }).click();
  await expect(page).toHaveURL(/\/gastos-ia$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Gastos com IA');
  await expect(page.getByRole('link', { name: 'Este mês' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('gastos-chamadas')).toContainText('6');
  await expect(page.getByTestId('gastos-audios')).toContainText('2');           // 90 s ≈ 2 min
  await expect(page.getByTestId('gastos-funcionalidade-testar_agente')).toContainText('Testar o agente');
  await expect(page.getByTestId('gastos-funcionalidade-especialista_setor')).toHaveCount(0); // só quando existir
  await expect(page.getByRole('table', { name: 'Gasto por dia' })).toBeAttached();          // alternativa em texto
});

test('Hoje e período inválido', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia?p=hoje');
  await expect(page.getByRole('link', { name: 'Hoje' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByTestId('gastos-total')).not.toContainText('Previsão'); // previsão só em "Este mês" (P4)
  await page.goto('/gastos-ia?p=periodo&de=2026-09-24&ate=2026-09-20');
  await expect(page.getByText('Período inválido: mostrando este mês.')).toBeVisible();
});

test('período sem gasto: zeros e estado vazio, sem "NaN"', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia?p=periodo&de=2020-01-01&ate=2020-01-31');
  await expect(page.getByTestId('gastos-por-atendimento')).toContainText('—');
  await expect(page.getByText('Nenhum gasto com IA neste período.')).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NaN');
});

test('atendente não vê o item nem a tela', async ({ page }) => {
  await entrar(page, dados.ana.email, dados.ana.senha);
  await expect(page.getByRole('link', { name: 'Gastos com IA' })).toHaveCount(0);
  await page.goto('/gastos-ia');
  await expect(page).toHaveURL(/\/inicio/);
});

test('ranking da equipe: só pessoas; clicar abre o detalhe linha a linha', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia');
  const ranking = page.getByRole('region', { name: 'Quem mais gasta na equipe' });
  await expect(ranking.getByRole('row')).toHaveCount(3);                 // cabeçalho + Thiago + Ana
  await expect(ranking.getByRole('row').nth(1)).toContainText('Thiago Gastos');
  await expect(ranking.getByText('Agente de clientes')).toHaveCount(0);   // agente fica fora do ranking
  await expect(ranking.getByText('Sugerir resposta')).toBeVisible();      // legenda sempre visível
  await ranking.getByRole('link', { name: /Ana Gastos/ }).click();
  await expect(page).toHaveURL(/pessoa=/);
  const painel = page.getByRole('dialog', { name: /Ana Gastos/ });
  await expect(painel.getByRole('row')).toHaveCount(3);                  // cabeçalho + sugestão + assistente
  await expect(painel).toContainText('Sugerir resposta');
});

test('gastos por cliente: abrir a empresa mostra os atendimentos e "abrir" leva à conversa naquele dia', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia');
  const clientes = page.getByRole('region', { name: 'Gastos por cliente' });
  await clientes.getByRole('searchbox', { name: 'Buscar empresa' }).fill('bom preço');
  await clientes.getByRole('searchbox', { name: 'Buscar empresa' }).press('Enter');
  await expect(page).toHaveURL(/busca=bom/);
  const linha = clientes.getByRole('button', { name: /Rede Bom Preço Gastos/ });
  await expect(linha).toHaveAttribute('aria-expanded', 'false');
  await linha.click();
  await expect(page).toHaveURL(/empresa=/);
  await expect(clientes.getByRole('button', { name: /Rede Bom Preço Gastos/ })).toHaveAttribute('aria-expanded', 'true');
  const atendimentos = clientes.getByRole('table', { name: /Atendimentos de Rede Bom Preço Gastos/ });
  await expect(atendimentos).toContainText('Carla Mendes');
  await expect(atendimentos).toContainText('passou para pessoa');        // hoje houve resposta de atendente
  await atendimentos.getByRole('link', { name: /abrir/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/atendimento/${dados.conversa}\\?data=\\d{4}-\\d{2}-\\d{2}`));
  await expect(page.locator('[data-dia-alvo="true"]')).toBeInViewport();
});

test('atendente: a exportação recusa (403)', async ({ page }) => {
  await entrar(page, dados.ana.email, dados.ana.senha);
  const resposta = await page.request.get('/gastos-ia/exportar?p=mes');
  expect(resposta.status()).toBe(403);
  expect(await resposta.text()).not.toContain('Data e hora');
  const daPessoa = await page.request.get(`/gastos-ia/exportar?p=mes&pessoa=${dados.ana.id}`);
  expect(daPessoa.status()).toBe(403);
});

test('exportar CSV do período', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia');
  const baixando = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Exportar' }).click();
  const arquivo = await baixando;
  expect(arquivo.suggestedFilename()).toMatch(/^gastos-ia-\d{4}-\d{2}-\d{2}-a-\d{4}-\d{2}-\d{2}\.csv$/);
  const texto = await (await import('node:fs/promises')).readFile(await arquivo.path(), 'utf8');
  expect(texto.split('\r\n')[0]).toContain('Data e hora;Funcionalidade;Pessoa');
  expect(texto).toContain('Sugerir resposta');
  expect(texto).not.toContain('5531');   // nenhum telefone sai no arquivo
  expect(texto.trimEnd().split('\r\n')).toHaveLength(7);   // cabeçalho + as 6 chamadas do mês
  expect(texto).toContain('Rede Bom Preço Gastos');
});

test('exportar só desta pessoa: o arquivo tem só as chamadas dela; pessoa inválida recusa', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto(`/gastos-ia?pessoa=${dados.ana.id}`);
  const painel = page.getByRole('dialog', { name: /Ana Gastos/ });
  const baixando = page.waitForEvent('download');
  await painel.getByRole('link', { name: 'Exportar só desta pessoa' }).click();
  const texto = await (await import('node:fs/promises')).readFile(await (await baixando).path(), 'utf8');
  const linhas = texto.trimEnd().split('\r\n');
  expect(linhas).toHaveLength(3);                                  // cabeçalho + sugestão + assistente
  expect(linhas.slice(1).every((l) => l.includes(';Ana Gastos;'))).toBe(true);
  expect((await page.request.get('/gastos-ia/exportar?p=mes&pessoa=nao-e-uuid')).status()).toBe(400);
});

test('Início: o cartão do gasto do mês lê a gastos_resumo e leva a Gastos com IA', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  const cartao = page.getByText('Gasto com IA no mês').locator('..');
  await expect(cartao).toContainText('2,31');                      // 0,4 + 0,2 + 0,01 + 0,3 + 0,5 + 0,9
  await cartao.getByRole('link', { name: 'Ver gastos' }).click();
  await expect(page).toHaveURL(/\/gastos-ia$/);
});

test('Início: atendente não vê o cartão do gasto', async ({ page }) => {
  await entrar(page, dados.ana.email, dados.ana.senha);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText('Gasto com IA no mês')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Ver gastos' })).toHaveCount(0);
});

test('exportar mais de 1000 chamadas: o arquivo traz todas (páginas de 1000 do PostgREST)', async ({ page }) => {
  // Março de 2021: nenhum outro teste olha esse período. Grupos de 5 no mesmo horário: a ordem desempata pelo id.
  const extras = Array.from({ length: 1205 }, (_, i) => ({
    modelo: 'e2e-gastos', provedor: 'anthropic', funcionalidade: 'agente_clientes', tokens_entrada: i + 1, tokens_saida: 0, custo_usd: 0.001,
    criado_em: new Date(Date.UTC(2021, 2, 10, 12, Math.floor(i / 5))).toISOString(),
  }));
  const { error } = await db.from('uso_ia').insert(extras);
  expect(error).toBeNull();
  try {
    await entrar(page, dados.admin.email, dados.admin.senha);
    const resposta = await page.request.get('/gastos-ia/exportar?p=periodo&de=2021-03-01&ate=2021-03-31');
    expect(resposta.status()).toBe(200);
    const linhas = (await resposta.text()).trimEnd().split('\r\n');
    expect(linhas).toHaveLength(1206);                                   // cabeçalho + 1205
    expect(new Set(linhas.slice(1).map((l) => l.split(';')[6])).size).toBe(1205); // nenhuma repetida nem pulada
    expect(linhas.at(-1)).not.toContain('Arquivo cortado');
  } finally {
    await db.from('uso_ia').delete().eq('modelo', 'e2e-gastos').lt('criado_em', '2022-01-01');
  }
});

test('teclado: Tab chega ao "Ver em tabela", à pessoa e à empresa; Enter abre e fecha; Esc fecha o painel e devolve o foco', async ({ page }) => {
  await entrar(page, dados.admin.email, dados.admin.senha);
  await page.goto('/gastos-ia');
  await expect(page.getByTestId('gastos-chamadas')).toBeVisible();

  // "Ver em tabela": Enter abre; a caixa que rola entra na ordem do Tab (com nome) e fechada não é parada do Tab.
  const verTabela = page.getByText('Ver em tabela');
  const caixa = page.getByRole('region', { name: 'Tabela do gasto por dia' });
  await expect(caixa).toHaveCount(0);
  await verTabela.focus();
  await page.keyboard.press('Enter');
  await expect(caixa).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(caixa).toBeFocused();
  await verTabela.focus();
  await page.keyboard.press('Enter');
  await expect(caixa).toHaveCount(0);

  // Pessoa do ranking: Tab alcança o link; Enter abre o painel; Esc fecha e o foco volta ao link.
  const ranking = page.getByRole('region', { name: 'Quem mais gasta na equipe' });
  const pessoa = ranking.getByRole('link', { name: /Ana Gastos/ });
  await pessoa.focus();
  await expect(pessoa).toBeFocused();
  await page.keyboard.press('Enter');
  const painel = page.getByRole('dialog', { name: /Ana Gastos/ });
  await expect(painel).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(painel).toBeHidden();
  await expect(page).not.toHaveURL(/pessoa=/);
  await expect(pessoa).toBeFocused();

  // Empresa: Enter abre e Enter fecha (aria-expanded), com o foco ficando no botão.
  const clientes = page.getByRole('region', { name: 'Gastos por cliente' });
  const empresa = clientes.getByRole('button', { name: /Rede Bom Preço Gastos/ });
  await empresa.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/empresa=/);
  await expect(clientes.getByRole('button', { name: /Rede Bom Preço Gastos/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(clientes.getByRole('table', { name: /Atendimentos de Rede Bom Preço Gastos/ })).toBeVisible();
  await clientes.getByRole('button', { name: /Rede Bom Preço Gastos/ }).focus();
  await page.keyboard.press('Enter');
  await expect(page).not.toHaveURL(/empresa=/);
  await expect(clientes.getByRole('button', { name: /Rede Bom Preço Gastos/ })).toHaveAttribute('aria-expanded', 'false');
});
