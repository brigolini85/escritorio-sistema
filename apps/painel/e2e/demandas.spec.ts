import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, empresaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C7';
const horaAtras = () => new Date(Date.now() - 3600_000).toISOString();

test.beforeEach(() => limparDemandasE2e(P));
test.afterAll(() => limparDemandasE2e(P));

test('tabela: duas informações por coluna, botões com contador, vencidas e concluídas', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  const cliente = await empresaE2e('Rede Bom Preço E2E', '90000000000107');
  const urgente = await demandaE2e({ titulo: `${P} Nota de venda`, setor: 'Fiscal', clienteId: cliente, prioridade: 'urgente' });
  await demandaE2e({ titulo: `${P} Admissão`, setor: 'Pessoal', status: 'em_andamento', prioridade: 'alta', origem: 'equipe' });
  await demandaE2e({ titulo: `${P} DAS em atraso`, setor: 'Fiscal', status: 'aguardando_cliente' });
  await demandaE2e({ titulo: `${P} Vencida`, setor: 'Fiscal', status: 'em_andamento', prazoEm: horaAtras() });
  await demandaE2e({ titulo: `${P} Concluída`, setor: 'Fiscal', status: 'concluido' });
  await entrar(page, 'admin@teste.com', SENHA);
  await page.goto(`/demandas?q=${P}`);

  await expect(page.getByRole('heading', { name: /Gestão das demandas/ })).toBeVisible();
  const rapidos = page.getByRole('navigation', { name: 'Filtros rápidos' });
  await expect(rapidos.getByRole('link', { name: 'Novas 1' })).toBeVisible();
  await expect(rapidos.getByRole('link', { name: 'Resolvendo 2' })).toBeVisible();
  await expect(rapidos.getByRole('link', { name: 'Com o cliente 1' })).toBeVisible();
  await expect(rapidos.getByRole('link', { name: 'Vencidas 1' })).toBeVisible();

  const linha = page.getByRole('row', { name: new RegExp(`${P} Nota de venda`) });
  for (const t of [`[${urgente.numero}]`, 'Rede Bom Preço E2E', 'Nova', 'Urgente', 'ninguém', 'WhatsApp', 'FISCAL']) await expect(linha).toContainText(t, { ignoreCase: true });
  await expect(page.getByRole('row', { name: new RegExp(`${P} Admissão`) })).toContainText('Equipe');
  await expect(page.getByRole('row', { name: new RegExp(`${P} Vencida`) })).toContainText('venceu');
  await expect(page.getByRole('row', { name: new RegExp(`${P} Concluída`) })).toHaveCount(0);

  await rapidos.getByRole('link', { name: /Vencidas/ }).click();
  await expect(page).toHaveURL(/vencidas=1/);
  await expect(page.getByRole('row', { name: new RegExp(P) })).toHaveCount(1);
  await rapidos.getByRole('link', { name: /Vencidas/ }).click();
  // Espera o filtro sair da URL: o próximo clique monta o link a partir da URL de agora.
  await expect(page).not.toHaveURL(/vencidas=1/);

  await rapidos.getByRole('link', { name: 'Concluídas' }).click();
  await expect(page).toHaveURL(/status=aberto%2Cem_andamento%2Caguardando_cliente%2Cconcluido|status=aberto,em_andamento,aguardando_cliente,concluido/);
  await expect(page.getByRole('row', { name: new RegExp(`${P} Concluída`) })).toBeVisible();

  await rapidos.getByRole('link', { name: 'Da equipe' }).click();
  await expect(page.getByRole('row', { name: new RegExp(P) })).toHaveCount(1);
});

test('busca por número e por empresa; filtros avançados viram etiquetas removíveis; ordenar por prazo', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  const cliente = await empresaE2e('Padaria Sol E2E', '90000000000280');
  const a = await demandaE2e({ titulo: `${P} Férias`, setor: 'Pessoal', clienteId: cliente });
  await demandaE2e({ titulo: `${P} Guia ICMS`, setor: 'Fiscal', prazoEm: horaAtras(), status: 'em_andamento' });
  await entrar(page, 'admin@teste.com', SENHA);

  await page.goto('/demandas');
  await page.getByRole('searchbox', { name: 'Buscar demandas' }).fill(String(a.numero));
  await expect(page).toHaveURL(new RegExp(`q=${a.numero}`));
  await expect(page.getByRole('row', { name: new RegExp(`${P} Férias`) })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Buscar demandas' }).fill('Padaria Sol E2E');
  await expect(page.getByRole('row', { name: new RegExp(`${P} Férias`) })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(`${P} Guia ICMS`) })).toHaveCount(0);

  await page.goto(`/demandas?q=${P}`);
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await page.getByLabel('Setor').selectOption({ label: 'Pessoal' });
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByRole('link', { name: 'Tirar filtro Setor: Pessoal' })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(P) })).toHaveCount(1);
  await page.getByRole('link', { name: 'Tirar filtro Setor: Pessoal' }).click();
  await expect(page.getByRole('row', { name: new RegExp(P) })).toHaveCount(2);

  await page.getByRole('navigation', { name: 'Ordenar' }).getByRole('link', { name: /Prazo/ }).click();
  await expect(page).toHaveURL(/ordem=prazo&direcao=asc/);
  await expect(page.getByRole('row').nth(1)).toContainText(`${P} Guia ICMS`);
});

test('atendente do Pessoal não vê demanda do Fiscal', async ({ page }) => {
  await demandaE2e({ titulo: `${P} Nota sigilosa`, setor: 'Fiscal', resumo: 'Nota sigilosa do Fiscal' });
  await criarUsuarioTeste({ email: 'caio@teste.com', senha: SENHA, nome: 'Caio', papel: 'atendente', setores: ['Pessoal'] });
  await entrar(page, 'caio@teste.com', SENHA);
  await page.goto('/demandas');
  await expect(page.getByRole('heading', { name: /Gestão das demandas/ })).toBeVisible();
  await expect(page.getByText(`${P} Nota sigilosa`)).toHaveCount(0);
  await db.from('chamados').delete().eq('titulo', `${P} Nota sigilosa`);
});
