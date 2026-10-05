import { expect, test } from '@playwright/test';
import { limparBanco } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { SENHA, abrirAgente, criarDono } from './apoio-agentes';

// Parte I1 (spec 7E.3, D13, D14, D15, D28, D29): ficha do agente.
test.beforeEach(async () => { await limparBanco(); });
const fiscal = async () => (await db.from('agentes').select('id, estado, modo_contato, ferramentas').eq('slug', 'fiscal').single()).data!;

test('dono põe o Fiscal em Teste com um contato, escolhe o modo, cria uma regra e libera uma ferramenta', async ({ page }) => {
  await criarDono();
  await db.from('contatos').insert({ nome: 'Carla Teste', telefone: '5531977771111' });
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal');
  await expect(page.getByText('Nesta etapa só o Thiago atende.')).toBeVisible();
  await page.getByRole('group', { name: 'Estado do agente' }).getByRole('button', { name: 'Teste' }).click();
  await page.getByPlaceholder('Nome ou telefone').fill('Carla');
  await page.getByRole('list', { name: 'Contatos encontrados' }).getByRole('button', { name: /Carla Teste/ }).click();
  await expect.poll(async () => (await fiscal()).estado).toBe('teste');
  await expect(page.getByText('Em teste:', { exact: true })).toBeVisible();
  await page.getByRole('navigation', { name: 'Seções do agente' }).getByRole('link', { name: 'Como fala com o cliente' }).click();
  await page.getByRole('radio', { name: 'Mesma voz' }).click();
  await expect.poll(async () => (await fiscal()).modo_contato).toBe('mesma_voz');
  await page.getByRole('button', { name: 'Nova regra' }).click();
  await page.getByLabel('Quando o assunto for').fill('Dúvida sobre imposto');
  await page.getByRole('combobox', { name: 'Modo' }).selectOption('passa_conversa');
  await page.getByRole('button', { name: 'Salvar regra' }).click();
  await expect(page.getByRole('cell', { name: 'Dúvida sobre imposto' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Seções do agente' }).getByRole('link', { name: /Ferramentas/ }).click();
  await page.getByLabel(/Ler demandas da empresa/).check();
  await page.getByRole('button', { name: 'Salvar' }).click();
  await expect.poll(async () => (await fiscal()).ferramentas).toEqual(['consultar_chamados']);
  await page.getByRole('button', { name: 'Histórico' }).click();
  await expect(page.getByText('Estado: Desligado → Teste')).toBeVisible();
});

test('o Thiago fica travado (Ligado, mesma voz, ferramentas fixas); o modelo o dono escolhe', async ({ page }) => {
  await criarDono();
  await entrar(page, 'dono@agentes.local', SENHA);
  await abrirAgente(page, 'atendimento');
  const estado = page.getByRole('group', { name: 'Estado do agente' });
  await expect(estado.getByRole('button', { name: 'Desligado', exact: true })).toBeDisabled();
  await expect(estado.getByRole('button', { name: 'Ligado', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('O Thiago fica sempre ligado. Para parar o atendimento, use PAUSAR no Início.')).toBeVisible();
  // O select só reage depois da hidratação: espera a rede assentar antes de escolher.
  await page.waitForLoadState('networkidle');
  await page.getByLabel('Modelo de IA').selectOption('claude-haiku-4-5');
  await expect(page.getByText('Modelo salvo.')).toBeVisible();
  await expect.poll(async () => (await db.from('agentes').select('modelo').eq('slug', 'atendimento').single()).data!.modelo).toBe('claude-haiku-4-5');
  await abrirAgente(page, 'atendimento', 'ferramentas');
  await expect(page.getByRole('checkbox')).toHaveCount(16);
  for (const c of await page.getByRole('checkbox').all()) await expect(c).toBeDisabled();
  await abrirAgente(page, 'atendimento', 'como-fala');
  await expect(page.getByText('Direto, é a voz do escritório')).toBeVisible();
});

test('administrador que não é dono vê a ficha, mas não muda', async ({ page }) => {
  await criarDono();
  await criarUsuarioTeste({ email: 'admin2@agentes.local', senha: SENHA, nome: 'Outro Admin', papel: 'admin' });
  await entrar(page, 'admin2@agentes.local', SENHA);
  await abrirAgente(page, 'fiscal');
  await expect(page.getByRole('group', { name: 'Estado do agente' }).getByRole('button', { name: 'Ligado', exact: true })).toBeDisabled();
  await abrirAgente(page, 'fiscal', 'ferramentas');
  await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0);
});
