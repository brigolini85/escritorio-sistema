import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { criarUsuarioTeste, db, entrar } from './apoio';

// Parte D (spec 7.2): horário de acesso no login, na aba aberta e para o administrador.
const SENHA = 'senha-forte-123';
const BLOQUEADO = { semana: null, sabado: null, domingo: null };

test('fora do horário o login recusa e diz por quê', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-horario@e2e.local', senha: SENHA, nome: 'Ana Horário', papel: 'atendente', setores: ['Fiscal'] });
  await db.from('usuarios').update({ horario_acesso: BLOQUEADO }).eq('id', ana);
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('ana-horario@e2e.local');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/entrar?erro=fora_do_horario');
  await expect(page.getByText('Fora do seu horário de acesso. Fale com o administrador se precisar entrar agora.')).toBeVisible();
});

test('aba aberta quando o horário acaba: a próxima tela explica, e volta quando libera', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-horario@e2e.local', senha: SENHA, nome: 'Ana Horário', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana-horario@e2e.local', SENHA);
  await db.from('usuarios').update({ horario_acesso: BLOQUEADO }).eq('id', ana);
  await page.goto('/demandas');
  await page.waitForURL('**/fora-do-horario');
  await expect(page.getByRole('heading', { name: 'Fora do seu horário de acesso' })).toBeVisible();
  await expect(page.getByText('Seu horário: seg a sex bloqueado · sábado bloqueado · domingo bloqueado.')).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  await db.from('usuarios').update({ horario_acesso: null }).eq('id', ana);
  await page.goto('/fora-do-horario');
  await page.waitForURL('**/inicio');
});

test('administrador entra a qualquer hora e o último acesso é marcado', async ({ page }) => {
  const admin = await criarUsuarioTeste({ email: 'admin-horario@e2e.local', senha: SENHA, nome: 'Admin Horário', papel: 'admin' });
  await db.from('usuarios').update({ horario_acesso: BLOQUEADO, ultimo_acesso_em: null }).eq('id', admin);
  await entrar(page, 'admin-horario@e2e.local', SENHA);
  await expect(page).toHaveURL(/\/inicio/);
  await expect.poll(async () => (await db.from('usuarios').select('ultimo_acesso_em').eq('id', admin).single()).data!.ultimo_acesso_em).not.toBeNull();
});
