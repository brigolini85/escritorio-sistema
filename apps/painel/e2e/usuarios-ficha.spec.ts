import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte D (spec 7.1, imagem 06): ficha em página inteira, níveis, administrador esconde permissões, erro sem perder nada.
const SENHA = 'senha-forte-123';

async function apagarLogin(email: string) {
  const { data } = await db.auth.admin.listUsers();
  for (const u of data.users.filter((x) => x.email === email)) await db.auth.admin.deleteUser(u.id);
}

test('nova pessoa: página inteira, níveis e horário gravados, convite enviado', async ({ page }) => {
  await apagarLogin('nova-ficha@e2e.local');
  await criarUsuarioTeste({ email: 'admin-ficha@e2e.local', senha: SENHA, nome: 'Admin Ficha', papel: 'admin' });
  await entrar(page, 'admin-ficha@e2e.local', SENHA);
  await page.goto('/usuarios');
  await page.getByRole('link', { name: 'Nova pessoa' }).click();
  await page.waitForURL('**/usuarios/novo', { timeout: 30_000 });
  const ficha = page.getByRole('form', { name: 'Nova pessoa' });
  await ficha.getByLabel('Nome', { exact: true }).fill('Nova Ficha');
  await ficha.getByLabel('E-mail de acesso').fill('nova-ficha@e2e.local');
  await ficha.getByLabel('Cargo').fill('Analista');
  await ficha.getByLabel('Fiscal').check();
  await ficha.getByLabel('Demandas', { exact: true }).selectOption('minhas');
  await ficha.getByLabel('Clientes e contatos').selectOption('editar');

  // Administrador = Sim esconde as permissões (menos o Assistente) e o horário; voltar mostra o que estava escolhido.
  await ficha.getByLabel('Administrador?').selectOption('admin');
  await expect(ficha.getByLabel('Demandas', { exact: true })).toBeHidden();
  await expect(ficha.getByLabel('Assistente')).toBeVisible();
  await expect(ficha.getByText('O administrador entra a qualquer hora.')).toBeVisible();
  await ficha.getByLabel('Administrador?').selectOption('atendente');
  await expect(ficha.getByLabel('Demandas', { exact: true })).toHaveValue('minhas');
  // Pessoa nova começa com o horário padrão: seg a sex 08 às 18, sábado e domingo bloqueados.
  await expect(ficha.getByLabel('Restringir o horário?')).toHaveValue('sim');
  await expect(ficha.getByLabel('Seg a sex: das')).toHaveValue('08:00');

  await ficha.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Convite enviado para nova-ficha@e2e.local.')).toBeVisible({ timeout: 30_000 });
  await page.waitForURL(/\/usuarios\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { name: 'Nova Ficha' })).toBeVisible({ timeout: 30_000 });
  const { data } = await db.from('usuarios').select('id, cargo, horario_acesso, usuario_permissoes(modulo, nivel)').eq('email', 'nova-ficha@e2e.local').single();
  expect(data!.cargo).toBe('Analista');
  expect(data!.horario_acesso).toEqual({ semana: { de: '08:00', ate: '18:00' }, sabado: null, domingo: null });
  const niveis = Object.fromEntries(data!.usuario_permissoes.map((p) => [p.modulo, p.nivel]));
  expect(niveis).toMatchObject({ demandas: 'minhas', clientes: 'editar', prazos: 'sim' });
  await apagarLogin('nova-ficha@e2e.local');
});

test('erro ao salvar mantém tudo o que foi digitado', async ({ page }) => {
  await criarUsuarioTeste({ email: 'admin-ficha@e2e.local', senha: SENHA, nome: 'Admin Ficha', papel: 'admin' });
  const bia = await criarUsuarioTeste({ email: 'bia-ficha@e2e.local', senha: SENHA, nome: 'Bia Ficha', papel: 'atendente' });
  await entrar(page, 'admin-ficha@e2e.local', SENHA);
  await page.goto(`/usuarios/${bia}`);
  const ficha = page.getByRole('form', { name: 'Cadastro de Bia Ficha' });
  await ficha.getByLabel('Cargo').fill('Coordenadora');
  await ficha.getByLabel('Observações').fill('Férias de 10 a 24/11');
  await ficha.getByLabel('Assistente').selectOption('site_whatsapp');
  await ficha.getByRole('button', { name: 'Salvar' }).click();
  await expect(ficha.getByText('Informe o telefone para usar o assistente pelo WhatsApp')).toBeVisible({ timeout: 30_000 });
  await expect(ficha.getByLabel('Telefone (WhatsApp)')).toHaveAttribute('aria-invalid', 'true');
  await expect(ficha.getByLabel('Cargo')).toHaveValue('Coordenadora');
  await expect(ficha.getByLabel('Observações')).toHaveValue('Férias de 10 a 24/11');
  await expect(ficha.getByText('Alterações não salvas')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/usuarios/${bia}$`));
  expect((await db.from('usuarios').select('cargo').eq('id', bia).single()).data!.cargo).toBeNull();
  const axe = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);

  await ficha.getByLabel('Telefone (WhatsApp)').fill('(31) 98877-0101');
  await ficha.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByText('Salvo: Bia Ficha.')).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await db.from('usuarios').select('cargo, telefone').eq('id', bia).single()).data)
    .toEqual({ cargo: 'Coordenadora', telefone: '5531988770101' });
});

test('na própria ficha o "Administrador?" fica travado; o link antigo ?usuario= abre a página', async ({ page }) => {
  const admin = await criarUsuarioTeste({ email: 'admin-ficha@e2e.local', senha: SENHA, nome: 'Admin Ficha', papel: 'admin' });
  await entrar(page, 'admin-ficha@e2e.local', SENHA);
  await page.goto(`/usuarios?usuario=${admin}`);
  await page.waitForURL(new RegExp(`/usuarios/${admin}$`), { timeout: 30_000 });
  await expect(page.getByLabel('Administrador?')).toBeDisabled({ timeout: 30_000 });
  await expect(page.getByText('Você não pode tirar o seu próprio acesso de administrador.')).toBeVisible();
});
