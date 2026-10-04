import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { abrirContatos, contagemFiltro, limparG3, linhaContato, PREFIXO, semearContatos } from './apoio-contatos';

const SENHA = 'senha-forte-123';
test.beforeEach(limparG3);
test.afterAll(limparG3);

async function comoAdmin(page: import('@playwright/test').Page) {
  await criarUsuarioTeste({ email: 'admin-g3@e2e.local', senha: SENHA, nome: 'Thiago G3', papel: 'admin' });
  await entrar(page, 'admin-g3@e2e.local', SENHA);
}

test('tabela: ordem pelo último contato, empresas ativas, selos "1 de 2", estado da conversa e a chave do agente', async ({ page }) => {
  const s = await semearContatos();
  await comoAdmin(page);
  await abrirContatos(page, `?q=${PREFIXO}`);
  const linhas = page.locator('tbody tr');
  await expect(linhas).toHaveCount(3);
  await expect(linhas.nth(0)).toContainText('Carla Mendes');
  await expect(linhas.nth(1)).toContainText('Roberto Nunes');
  await expect(linhas.nth(2)).toContainText('Sandra Costa'); // sem conversa: no fim (D19)

  const carla = linhaContato(page, 'Carla Mendes');
  await expect(carla).toContainText(`${PREFIXO} Rede Bom Preço Ltda`);
  await expect(carla).toContainText(`${PREFIXO} Mercado Central`);
  await expect(carla).not.toContainText('Zeta'); // empresa arquivada não aparece (D5)
  await expect(carla).toContainText('Pede nota · 1 de 2');
  await expect(carla).not.toContainText('Muda preço'); // a marcação era só na arquivada
  await expect(carla).toContainText(/(hoje|ontem) \d{2}:\d{2}/);
  await expect(carla).toContainText('esperando pessoa');
  await expect(carla.getByRole('link', { name: `Abrir a conversa com ${PREFIXO} Carla Mendes` })).toHaveAttribute('href', `/atendimento/${s.conversaCarla}`);

  const roberto = linhaContato(page, 'Roberto Nunes');
  await expect(roberto).toContainText('Pede nota');
  await expect(roberto).toContainText('Muda preço e cadastra produto');
  await expect(roberto).toContainText('com o agente');

  const sandra = linhaContato(page, 'Sandra Costa');
  await expect(sandra).toContainText('sem empresa');
  await expect(sandra).toContainText('sem conversa');
  await expect(sandra).toContainText('desligado');
  await expect(sandra.getByRole('button', { name: `Abrir a conversa com ${PREFIXO} Sandra Costa` })).toBeDisabled();
  await sandra.getByRole('switch', { name: /Ligar o agente/ }).click();
  await expect.poll(async () => (await db.from('contatos').select('agente_pausado').eq('id', s.sandra).single()).data!.agente_pausado).toBe(false);
});

test('busca pela empresa, filtros rápidos com contagem, seletor de empresa e período do último contato', async ({ page }) => {
  await semearContatos();
  await comoAdmin(page);
  await abrirContatos(page, `?q=${PREFIXO}`);
  expect({
    todos: await contagemFiltro(page, 'todos'), desligado: await contagemFiltro(page, 'desligado'),
    sem_empresa: await contagemFiltro(page, 'sem_empresa'), nota: await contagemFiltro(page, 'nota'), preco: await contagemFiltro(page, 'preco'),
  }).toEqual({ todos: 3, desligado: 1, sem_empresa: 1, nota: 2, preco: 1 });
  await page.locator('[data-filtro="nota"]').click();
  await expect(page).toHaveURL(/filtro=nota/);
  await expect(page.locator('[data-filtro="nota"]')).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(linhaContato(page, 'Sandra Costa')).toHaveCount(0);

  // Busca pela empresa: a Carla não tem "Mercado" no nome (D20).
  await abrirContatos(page);
  await page.getByRole('searchbox', { name: 'Buscar por nome, telefone ou empresa' }).fill(`${PREFIXO} Mercado`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Carla Mendes');

  // Seletor de empresa e período.
  await abrirContatos(page, `?q=${PREFIXO}`);
  await page.getByRole('combobox', { name: 'Empresa' }).click();
  await page.getByRole('option', { name: `${PREFIXO} Rede Bom Preço Ltda` }).click();
  await expect(page).toHaveURL(/empresa=/);
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await abrirContatos(page, `?q=${PREFIXO}&periodo=nunca`);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Sandra Costa');
  expect(await contagemFiltro(page, 'todos')).toBe(1);
});

test('"Conversas dos meus setores" vê o contato, mas não a conversa de fora deles (contagens também)', async ({ page }) => {
  const s = await semearContatos();
  await criarUsuarioTeste({ email: 'ana-g3@e2e.local', senha: SENHA, nome: 'Ana G3', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana-g3@e2e.local', SENHA);
  await abrirContatos(page, `?q=${PREFIXO}`);
  const carla = linhaContato(page, 'Carla Mendes');
  await expect(carla).toContainText('nenhuma conversa visível');
  await expect(carla).not.toContainText('esperando pessoa');
  await expect(carla.getByRole('button', { name: `Abrir a conversa com ${PREFIXO} Carla Mendes` })).toBeDisabled();
  await abrirContatos(page, `?q=${PREFIXO}&periodo=nunca`);
  // Carla, Roberto e Sandra: para a Ana, nem a conversa da Carla nem a do Roberto (sem demanda no Fiscal) existem (D2).
  expect(await contagemFiltro(page, 'todos')).toBe(3);
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(linhaContato(page, 'Carla Mendes')).toHaveCount(1);

  // Uma demanda do Fiscal na conversa da Carla: a Ana passa a ver a conversa (Parte D).
  const { data: fiscal } = await db.from('setores').select('id').eq('nome', 'Fiscal').single();
  await db.from('chamados').insert({ conversa_id: s.conversaCarla, setor_id: fiscal!.id, titulo: `${PREFIXO} boleto` });
  await abrirContatos(page, `?q=${PREFIXO}`);
  await expect(linhaContato(page, 'Carla Mendes')).toContainText('esperando pessoa');
  await expect(linhaContato(page, 'Carla Mendes').getByRole('link', { name: `Abrir a conversa com ${PREFIXO} Carla Mendes` })).toBeVisible();
});

test('lista grande: 50 por página, contagem pelo servidor e a página seguinte', async ({ page }) => {
  await db.from('contatos').insert(Array.from({ length: 55 }, (_, i) => ({
    nome: `${PREFIXO} Pag ${String(i + 1).padStart(2, '0')}`, telefone: `55319800300${String(i + 1).padStart(2, '0')}`,
  })));
  await comoAdmin(page);
  await abrirContatos(page, `?q=${PREFIXO}%20Pag&ordem=nome&direcao=asc`);
  expect(await contagemFiltro(page, 'todos')).toBe(55);
  await expect(page.locator('tbody tr')).toHaveCount(50);
  await expect(page.getByText('Mostrando 1–50 de 55')).toBeVisible();
  await page.getByRole('link', { name: 'Próxima' }).click();
  await expect(page.getByText('Mostrando 51–55 de 55')).toBeVisible();
  await expect(page.locator('tbody tr').first()).toContainText(`${PREFIXO} Pag 51`);
});
