import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { limparBanco, sqlTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste, entrar } from './apoio';
import { MENSAGEM_MEDIA, SENHA, TITULO_MEDIA, clientesComContatos, prepararRadar } from './apoio-radar';

// Parte I5 (D14): a mensagem aos clientes só sai com aprovação de uma pessoa do setor; aqui não há trabalhador, então nada é enviado.
test.beforeEach(async () => { await limparBanco(); });
test.afterAll(async () => { await limparBanco(); });

const cartao = (page: Page) => page.getByTestId('novidade').filter({ hasText: TITULO_MEDIA });

async function preparar() {
  await clientesComContatos();   // antes das novidades: a contagem de clientes afetados é gravada na criação
  return prepararRadar();
}

test('rascunho: não enviado, só sai com aprovação; escolher clientes lista Padaria e Lua', async ({ page }) => {
  await preparar();
  await entrar(page, 'dono@agentes.local', SENHA);
  await page.goto('/agentes/radar');
  const bloco = cartao(page).getByTestId('radar-mandar');
  await expect(bloco).toContainText('não enviado');
  await expect(bloco).toContainText('só sai com aprovação');
  await expect(bloco).toContainText(MENSAGEM_MEDIA);
  await bloco.getByRole('button', { name: 'Escolher clientes' }).click();
  const j = page.getByRole('dialog');
  await expect(j.getByText('Padaria Sol ME')).toBeVisible();
  await expect(j.getByText('2 contatos podem ser procurados')).toBeVisible();
  await expect(j.getByText('Mercado Lua Ltda')).toBeVisible();
  await expect(j.getByText(/1 contato pode ser procurado/)).toBeVisible();
  await expect(j.getByText('Todos os 2 clientes')).toBeVisible();
  await j.getByRole('checkbox', { name: /Mercado Lua/ }).click();
  await expect(j.getByText('1 de 2 clientes')).toBeVisible();
});

test('quem é de outro setor (Paula, Pessoal) não aprova o envio do Fiscal', async ({ page }) => {
  await preparar();
  await criarUsuarioTeste({ email: 'paula@agentes.local', senha: SENHA, nome: 'Paula', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Pessoal'] });
  await entrar(page, 'paula@agentes.local', SENHA);
  await page.goto('/agentes/radar');
  await expect(cartao(page).getByText('Quem aprova é uma pessoa do setor Fiscal.')).toBeVisible();
  await expect(cartao(page).getByRole('button', { name: 'Aprovar e enviar' })).toHaveCount(0);
});

test('Ana (Fiscal) edita, aprova e a lista fica aguardando o trabalhador, sem mensagem nenhuma', async ({ page }) => {
  await preparar();
  await criarUsuarioTeste({ email: 'ana@agentes.local', senha: SENHA, nome: 'Ana', papel: 'atendente', permissoes: ['treinar_agente'], setores: ['Fiscal'] });
  await entrar(page, 'ana@agentes.local', SENHA);
  await page.goto('/agentes/radar');
  const bloco = cartao(page).getByTestId('radar-mandar');
  const novo = 'Olá! O prazo da DCTF Web mudou para o dia 20. Qualquer dúvida, é só chamar.';
  await bloco.getByRole('button', { name: 'Editar' }).click();
  await bloco.getByLabel('Mensagem para os clientes').fill(novo);
  await bloco.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Mensagem salva.')).toBeVisible();
  expect(await sqlTeste('select 1 from public.radar_envios')).toHaveLength(0);
  await bloco.getByRole('button', { name: 'Escolher clientes' }).click();
  const j = page.getByRole('dialog');
  await expect(j.getByText('Todos os 2 clientes')).toBeVisible();
  await j.getByRole('checkbox', { name: /Mercado Lua/ }).click();
  await expect(j.getByText('1 de 2 clientes · 2 contatos')).toBeVisible();
  await j.getByRole('button', { name: 'Aprovar e enviar' }).click();
  await expect(page.getByText(/Aprovado: 2 contatos recebem/)).toBeVisible();
  const envios = await sqlTeste<{ estado: string; texto: string; telefone: string }>(
    'select e.estado, e.texto, c.telefone from public.radar_envios e join public.contatos c on c.id = e.contato_id order by c.telefone');
  expect(envios).toEqual([
    { estado: 'aguardando', texto: novo, telefone: '5531988880001' },
    { estado: 'aguardando', texto: novo, telefone: '5531988880005' },
  ]);
  expect(await sqlTeste('select 1 from public.mensagens')).toHaveLength(0);
});

test('a janela de clientes não tem violações de acessibilidade', async ({ page }) => {
  await preparar();
  await entrar(page, 'dono@agentes.local', SENHA);
  await page.goto('/agentes/radar');
  await cartao(page).getByTestId('radar-mandar').getByRole('button', { name: 'Escolher clientes' }).click();
  await expect(page.getByRole('dialog').getByText('Padaria Sol ME')).toBeVisible();
  const r = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
});
