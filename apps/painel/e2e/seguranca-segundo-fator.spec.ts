import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { sqlTeste } from '@escritorio/db/teste';
import { criarUsuarioTeste, db, entrar, zerarTentativas } from './apoio';
import { chaveDe, codigoTotp, guardarChave } from './apoio-mfa';
import { exigirBancoLocal } from './trava-local';import { apagarPessoas } from './apoio-sessao';


// Segurança do login (item 8): aplicativo autenticador obrigatório para administrador e para quem vê acessos de portais.
const SENHA = 'senha-forte-123';
const ADMIN = 'admin-fator@e2e.local';

async function soASenha(page: Page, email: string) {
  await zerarTentativas();
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

async function axeSemGraves(page: Page) {
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
}

const AVISO_FATOR = 'Admin Fator cadastrou um aplicativo de código';
test.afterAll(async () => {
  await apagarPessoas(['admin-fator@e2e.local', 'bia-fator@e2e.local', 'admin-api@e2e.local']);
  await db.from('alertas').delete().eq('mensagem', AVISO_FATOR);
});

test('administrador no primeiro login cadastra o aplicativo; no seguinte só digita o código', async ({ page }) => {
  await criarUsuarioTeste({ email: ADMIN, senha: SENHA, nome: 'Admin Fator', papel: 'admin' });
  await db.from('alertas').delete().eq('mensagem', AVISO_FATOR);
  await soASenha(page, ADMIN);
  await page.waitForURL('**/segundo-fator');
  await expect(page.getByRole('heading', { name: 'Proteja seu acesso com o celular' })).toBeVisible();
  await axeSemGraves(page);
  await page.getByRole('button', { name: 'Mostrar o QR code' }).click();
  await expect(page.getByRole('img', { name: 'QR code para cadastrar o painel no aplicativo autenticador' })).toBeVisible();
  await axeSemGraves(page);
  const segredo = (await page.getByTestId('segredo-totp').textContent())!.replace(/\s+/g, '');
  guardarChave(ADMIN, segredo);

  // Antes do código, nenhuma outra tela abre.
  await page.goto('/usuarios');
  await page.waitForURL('**/segundo-fator');
  // A tela recarregou: cadastro novo, chave nova.
  await page.getByRole('button', { name: 'Mostrar o QR code' }).click();
  const segredoNovo = (await page.getByTestId('segredo-totp').textContent())!.replace(/\s+/g, '');
  guardarChave(ADMIN, segredoNovo);

  // Código errado: o aviso aparece e o QR code na tela continua o mesmo (a pessoa não precisa ler de novo).
  await page.getByLabel('Código do aplicativo').fill('000000');
  await page.getByRole('button', { name: 'Ativar e entrar' }).click();
  await expect(page.getByText('Código incorreto ou vencido.')).toHaveText('Código incorreto ou vencido. Confira se a hora do celular está certa e digite o código novo.');
  await expect(page.getByTestId('segredo-totp')).toHaveText(segredoNovo.replace(/(.{4})/g, '$1 ').trim());

  await page.getByLabel('Código do aplicativo').fill(codigoTotp(segredoNovo));
  await page.getByRole('button', { name: 'Ativar e entrar' }).click();
  await page.waitForURL('**/inicio');
  // Auditoria 2.5: o cadastro do aplicativo vira aviso (ao dono; sem dono marcado, aos administradores).
  await expect.poll(async () => (await db.from('alertas').select('id').eq('mensagem', AVISO_FATOR)).data?.length).toBe(1);
  await page.goto('/usuarios');
  await expect(page).toHaveURL(/\/usuarios/);

  // Sai e entra de novo: agora só o código.
  await page.context().clearCookies();
  await soASenha(page, ADMIN);
  await page.waitForURL('**/segundo-fator');
  await expect(page.getByRole('heading', { name: 'Confirme que é você' })).toBeVisible();
  await expect(page.getByTestId('segredo-totp')).toHaveCount(0);
  await axeSemGraves(page);
  await page.getByLabel('Código do aplicativo').fill(codigoTotp(chaveDe(ADMIN)));
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.waitForURL('**/inicio');
});

test('atendente sem "Ver acessos de portais" entra só com a senha; ganhou a permissão, passa a pedir o código', async ({ page }) => {
  const id = await criarUsuarioTeste({ email: 'bia-fator@e2e.local', senha: SENHA, nome: 'Bia Fator', papel: 'atendente', setores: ['Fiscal'] });
  await soASenha(page, 'bia-fator@e2e.local');
  await page.waitForURL('**/inicio');
  await db.from('usuarios').update({ ver_acessos_portais: true }).eq('id', id);
  await page.goto('/clientes');
  await page.waitForURL('**/segundo-fator');
  await expect(page.getByRole('heading', { name: 'Proteja seu acesso com o celular' })).toBeVisible();
});

test('o banco recusa as ações sensíveis de quem só usou a senha (chamada direto pela API)', async () => {
  const id = await criarUsuarioTeste({ email: 'admin-api@e2e.local', senha: SENHA, nome: 'Admin API', papel: 'admin' });
  exigirBancoLocal(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!, { auth: { persistSession: false } });
  const { error: login } = await sb.auth.signInWithPassword({ email: 'admin-api@e2e.local', password: SENHA });
  expect(login).toBeNull();
  const MSG = 'Confirme o código do aplicativo autenticador para continuar.';
  expect((await sb.rpc('salvar_usuario', { p_id: id, p_dados: { nome: 'Outro Nome', papel: 'admin' } })).error?.message).toBe(MSG);
  expect((await sb.rpc('definir_ver_acessos', { p_usuario: id, p_pode: true })).error?.message).toBe(MSG);
  expect((await sb.rpc('arquivar_cadastro', { p_tipo: 'usuario', p_id: id })).error?.message).toBe(MSG);
  expect((await db.from('usuarios').select('nome, ativo').eq('id', id).single()).data).toEqual({ nome: 'Admin API', ativo: true });
});

// Auditoria 2.1 e 2.8: com só a senha, a escrita direta na tabela também não passa (nem leitura da própria linha).
test('administrador em aal1 chama update direto em usuarios pela API: nada muda', async () => {
  const id = await criarUsuarioTeste({ email: 'admin-api@e2e.local', senha: SENHA, nome: 'Admin API', papel: 'admin' });
  exigirBancoLocal(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!, { auth: { persistSession: false } });
  expect((await sb.auth.signInWithPassword({ email: 'admin-api@e2e.local', password: SENHA })).error).toBeNull();
  await sb.from('usuarios').update({ nome: 'X' }).eq('id', id);
  expect((await sb.from('usuarios').select('id').eq('id', id)).data ?? []).toEqual([]);
  expect((await db.from('usuarios').select('nome').eq('id', id).single()).data).toEqual({ nome: 'Admin API' });
});

test('celular perdido: o SQL de recuperação apaga o fator e o próximo login cadastra de novo', async ({ page }) => {
  await criarUsuarioTeste({ email: ADMIN, senha: SENHA, nome: 'Admin Fator', papel: 'admin' });
  await entrar(page, ADMIN, SENHA);
  // O mesmo SQL do documento para o dono.
  await sqlTeste(`delete from auth.mfa_factors where user_id = (select id from auth.users where email = '${ADMIN}')`);
  await page.context().clearCookies();
  await soASenha(page, ADMIN);
  await page.waitForURL('**/segundo-fator');
  await expect(page.getByRole('heading', { name: 'Proteja seu acesso com o celular' })).toBeVisible();
});

test('nova senha pelo link do e-mail, com o aplicativo já cadastrado: confirma o código e grava a senha', async ({ page }) => {
  await criarUsuarioTeste({ email: ADMIN, senha: SENHA, nome: 'Admin Fator', papel: 'admin' });
  await entrar(page, ADMIN, SENHA);
  await page.context().clearCookies();
  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email: ADMIN });
  expect(error).toBeNull();
  await page.goto(`/auth/confirm?token_hash=${data.properties!.hashed_token}&type=recovery`);
  await page.waitForURL('**/definir-senha');
  await page.getByLabel('Nova senha').fill('Senha-nova-2026');
  await page.getByRole('button', { name: 'Salvar' }).click();
  // Com o aplicativo cadastrado, o Supabase só troca a senha depois do código (aal2): a tela pede o código e volta.
  await page.waitForURL('**/segundo-fator?depois=senha');
  await page.getByLabel('Código do aplicativo').fill(codigoTotp(chaveDe(ADMIN)));
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await page.waitForURL('**/definir-senha');
  await page.getByLabel('Nova senha').fill('Senha-nova-2026');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForURL('**/inicio');
  await page.context().clearCookies();
  await entrar(page, ADMIN, 'Senha-nova-2026');
  await expect(page).toHaveURL(/\/inicio/);
});
