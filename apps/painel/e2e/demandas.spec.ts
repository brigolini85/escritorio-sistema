import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { demandaE2e, empresaE2e, limparDemandasE2e } from './apoio-demandas';

const SENHA = 'senha-forte-123';
const P = 'E2E-C7';
const horaAtras = () => new Date(Date.now() - 3600_000).toISOString();

// Prefixo sem algarismos para a busca por número: a busca também procura o número no título, no resumo e na empresa,
// e com o banco zerado o número é pequeno (2, 7...): acharia o algarismo em "E2E-C7" e mostraria as outras linhas.
const PN = 'Busca-numero';

test.beforeEach(async () => { await limparDemandasE2e(P); await limparDemandasE2e(PN); });
test.afterAll(async () => { await limparDemandasE2e(P); await limparDemandasE2e(PN); });

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

  await expect(page.getByRole('heading', { name: /Gestão das demandas/ })).toBeVisible({ timeout: 30_000 });
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

test('busca por número e por empresa: cada uma mostra só o que é dela', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  const cliente = await empresaE2e('Padaria Sol Busca', '90000000000280');
  const a = await demandaE2e({ titulo: `${PN} Férias`, setor: 'Pessoal', clienteId: cliente });
  await demandaE2e({ titulo: `${PN} Contas`, setor: 'Fiscal', clienteId: cliente });
  await demandaE2e({ titulo: `${PN} Guia ICMS`, setor: 'Fiscal' });
  await entrar(page, 'admin@teste.com', SENHA);

  await page.goto('/demandas');
  await expect(page.getByRole('heading', { name: /Gestão das demandas/ })).toBeVisible({ timeout: 30_000 });
  const busca = page.getByRole('searchbox', { name: 'Buscar demandas' });
  const linha = (nome: string) => page.getByRole('row', { name: new RegExp(`${PN} ${nome}`) });

  // Número: só a demanda dele. Pelo "#": com o banco zerado o número tem um algarismo e a busca ignora termo de um
  // caractere (MINIMO_BUSCA = 2), mostrando todas; "#6" é a busca pelo número 6 (interpretarBusca).
  await busca.fill(`#${a.numero}`);
  await expect(page).toHaveURL(new RegExp(`q=(%23|#)${a.numero}(&|$)`), { timeout: 15_000 });
  await expect(linha('Férias')).toBeVisible();
  await expect(linha('Contas')).toHaveCount(0);
  await expect(linha('Guia ICMS')).toHaveCount(0);

  // Empresa: Contas (que a busca por número escondeu) aparece junto com Férias; a de outra empresa continua fora.
  await busca.fill('Padaria Sol Busca');
  await expect(page).toHaveURL(/q=Padaria/, { timeout: 15_000 });
  await expect(linha('Contas')).toBeVisible();
  await expect(linha('Férias')).toBeVisible();
  await expect(linha('Guia ICMS')).toHaveCount(0);
});

test('filtros avançados viram etiquetas removíveis; ordenar por prazo muda a ordem', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin@teste.com', senha: SENHA, nome: 'Admin', papel: 'admin' });
  // A mais antiga em atualização é a que vence primeiro: a ordem padrão (atualização) e a do prazo são opostas.
  await demandaE2e({ titulo: `${P} Guia ICMS`, setor: 'Fiscal', prazoEm: horaAtras(), status: 'em_andamento' });
  await demandaE2e({ titulo: `${P} Férias`, setor: 'Pessoal', prazoEm: new Date(Date.now() + 5 * 86_400_000).toISOString() });
  await entrar(page, 'admin@teste.com', SENHA);

  await page.goto(`/demandas?q=${P}`);
  await expect(page.getByRole('heading', { name: /Gestão das demandas/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await page.getByLabel('Setor').selectOption({ label: 'Pessoal' });
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByRole('link', { name: 'Tirar filtro Setor: Pessoal' })).toBeVisible();
  await expect(page.getByRole('row', { name: new RegExp(P) })).toHaveCount(1);
  await page.getByRole('link', { name: 'Tirar filtro Setor: Pessoal' }).click();
  await expect(page.getByRole('row', { name: new RegExp(P) })).toHaveCount(2);

  await expect(page.getByRole('row').nth(1)).toContainText(`${P} Férias`);
  await page.getByRole('navigation', { name: 'Ordenar' }).getByRole('link', { name: /Prazo/ }).click();
  await expect(page).toHaveURL(/ordem=prazo&direcao=asc/);
  await expect(page.getByRole('row').nth(1)).toContainText(`${P} Guia ICMS`);
  await expect(page.getByRole('row').nth(2)).toContainText(`${P} Férias`);
});

test('atendente do Pessoal não vê demanda do Fiscal', async ({ page }) => {
  await demandaE2e({ titulo: `${P} Nota sigilosa`, setor: 'Fiscal', resumo: 'Nota sigilosa do Fiscal' });
  await criarUsuarioTeste({ email: 'caio@teste.com', senha: SENHA, nome: 'Caio', papel: 'atendente', setores: ['Pessoal'] });
  await entrar(page, 'caio@teste.com', SENHA);
  await page.goto('/demandas');
  await expect(page.getByRole('heading', { name: /Gestão das demandas/ })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(`${P} Nota sigilosa`)).toHaveCount(0);
  await db.from('chamados').delete().eq('titulo', `${P} Nota sigilosa`);
});
