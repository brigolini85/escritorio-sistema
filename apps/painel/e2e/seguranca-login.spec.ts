import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { criarUsuarioTeste, db, entrar, zerarTentativas } from './apoio';
import { exigirBancoLocal } from './trava-local';import { apagarPessoas } from './apoio-sessao';


// Segurança do login (item 10): os casos que faltavam na especificação.
const SENHA = 'senha-forte-123';
const BLOQUEADO = { semana: null, sabado: null, domingo: null };

function clientePublico() {
  exigirBancoLocal(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!, { auth: { persistSession: false } });
}

test.afterAll(async () => { await apagarPessoas(['ana-sl@e2e.local', 'adm-sl@e2e.local', 'arq-sl@e2e.local', 'sem-cadastro@e2e.local', 'volta-sl@e2e.local']); });

test('logado, o horário muda: ao recarregar a tela fica bloqueada', async ({ page }) => {
  const ana = await criarUsuarioTeste({ email: 'ana-sl@e2e.local', senha: SENHA, nome: 'Ana SL', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'ana-sl@e2e.local', SENHA);
  await page.goto('/demandas');
  await expect(page).toHaveURL(/\/demandas/);
  await db.from('usuarios').update({ horario_acesso: BLOQUEADO }).eq('id', ana);
  await page.reload();
  await page.waitForURL('**/fora-do-horario');
});

test('administrador fora do horário dele segue usando o painel', async ({ page }) => {
  const adm = await criarUsuarioTeste({ email: 'adm-sl@e2e.local', senha: SENHA, nome: 'Adm SL', papel: 'admin' });
  await db.from('usuarios').update({ horario_acesso: BLOQUEADO }).eq('id', adm);
  await entrar(page, 'adm-sl@e2e.local', SENHA);
  await page.goto('/usuarios');
  await expect(page).toHaveURL(/\/usuarios/);
});

test('?erro= desconhecido na tela de entrada vira texto genérico', async ({ page }) => {
  await page.goto('/entrar?erro=Ligue%20para%200800%20e%20passe%20sua%20senha');
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível entrar.' })).toBeVisible();
  await expect(page.getByText('Ligue para 0800')).toHaveCount(0);
});

test('pessoa arquivada com o token ainda na mão: o banco recusa direto pela API', async () => {
  const id = await criarUsuarioTeste({ email: 'arq-sl@e2e.local', senha: SENHA, nome: 'Arq SL', papel: 'atendente', setores: ['Fiscal'] });
  const sb = clientePublico();
  expect((await sb.auth.signInWithPassword({ email: 'arq-sl@e2e.local', password: SENHA })).error).toBeNull();
  await db.from('clientes').delete().eq('cnpj', '11444777000161');
  await db.from('clientes').insert({ razao_social: 'SL Ltda', cnpj: '11444777000161' });
  expect((await sb.from('clientes').select('id').eq('cnpj', '11444777000161')).data).toHaveLength(1);
  // Arquivada: o token de acesso (até 1 h) ainda é aceito pelo PostgREST, mas a RLS não entrega nada.
  await db.from('usuarios').update({ ativo: false }).eq('id', id);
  expect((await sb.from('clientes').select('id').eq('cnpj', '11444777000161')).data).toEqual([]);
  expect((await sb.rpc('definir_visao_demandas', { p_visao: 'quadro' })).error?.message).toBe('Acesso desativado.');
  await db.from('clientes').delete().eq('cnpj', '11444777000161');
});

test('token inválido: o painel pede login e a API do banco recusa', async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: 'sb-127-auth-token', value: 'base64-eyJhY2Nlc3NfdG9rZW4iOiJmYWxzbyJ9', url: baseURL! }]);
  await page.goto('/clientes');
  await expect(page).toHaveURL(/\/entrar$/);
  const r = await page.request.get('/api/busca?q=ana', { headers: { accept: 'application/json' } });
  expect(r.status()).toBe(401);
  const rest = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/clientes?select=id`, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!, authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4Iiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQifQ.assinatura-falsa' },
  });
  expect(rest.status).toBe(401);
});

test('login sem cadastro no painel é recusado e deslogado', async ({ page }) => {
  const { data: lista } = await db.auth.admin.listUsers();
  for (const u of lista.users.filter((x) => x.email === 'sem-cadastro@e2e.local')) await db.auth.admin.deleteUser(u.id);
  const { error } = await db.auth.admin.createUser({ email: 'sem-cadastro@e2e.local', password: SENHA, email_confirm: true });
  expect(error).toBeNull();
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill('sem-cadastro@e2e.local');
  await page.getByLabel('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/entrar?erro=inativo');
  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/entrar$/);
});

test('depois de Sair, o Voltar do navegador não mostra a página protegida', async ({ page }) => {
  await criarUsuarioTeste({ email: 'volta-sl@e2e.local', senha: SENHA, nome: 'Volta SL', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'volta-sl@e2e.local', SENHA);
  await page.goto('/demandas');
  await expect(page.getByRole('heading', { name: 'Demandas', level: 1 })).toBeVisible();
  const r = await page.request.get('/demandas');
  expect(r.headers()['cache-control']).toContain('no-store');
  // Auditoria 2.10: /api/* também sai sem cache (o middleware põe no-store, private).
  const api = await page.request.get('/api/busca?q=ana', { headers: { accept: 'application/json' } });
  expect(api.headers()['cache-control']).toContain('no-store');
  await page.getByRole('complementary').getByRole('button', { name: 'Sair' }).click();
  await page.waitForURL('**/entrar');
  await page.goBack();
  // Dá tempo de o navegador (ou o roteador do Next) mostrar o que tivesse guardado.
  await page.waitForTimeout(2_000);
  await expect(page).toHaveURL(/\/entrar/);
  await expect(page.getByRole('heading', { name: 'Demandas', level: 1 })).toHaveCount(0);
});

// Auditoria 2.3: o painel limita as tentativas antes do Supabase (5 por minuto do mesmo IP).
test('seis tentativas seguidas no mesmo minuto: a sexta mostra o aviso de muitas tentativas', async ({ page }) => {
  await zerarTentativas();
  for (let i = 1; i <= 6; i++) {
    await page.goto('/entrar');
    await page.getByLabel('E-mail').fill(`tentativa${i}@e2e.local`);
    await page.getByLabel('Senha').fill('senha-errada-123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await page.waitForURL(/\/entrar\?erro=/);
  }
  await expect(page).toHaveURL(/erro=tentativas/);
  await expect(page.getByRole('alert').filter({ hasText: 'Muitas tentativas. Espere alguns minutos e tente de novo.' })).toBeVisible();
  await zerarTentativas();
});

// Auditoria 2.6: com sessão de login comum, /definir-senha pede a senha atual; pelo link do e-mail, troca direto.
test('trocar a senha logado pede a senha atual; pelo link recente, não', async ({ page }) => {
  await criarUsuarioTeste({ email: 'troca-sl@e2e.local', senha: SENHA, nome: 'Troca SL', papel: 'atendente', setores: ['Fiscal'] });
  await entrar(page, 'troca-sl@e2e.local', SENHA);
  await page.goto('/definir-senha');
  await page.getByLabel('Senha atual').fill('senha-errada-999');
  await page.getByLabel('Nova senha').fill('Senha-nova-2026');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForURL('**/definir-senha?erro=atual_errada');
  await expect(page.getByRole('alert').filter({ hasText: 'Senha atual incorreta.' })).toBeVisible();
  // Sem a senha atual no pedido (formulário montado à mão): recusa sem trocar.
  await page.evaluate(() => document.querySelector<HTMLInputElement>('#senha-atual')?.removeAttribute('required'));
  await page.getByLabel('Nova senha').fill('Senha-nova-2026');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForURL('**/definir-senha?erro=atual');
  const sb = clientePublico();
  expect((await sb.auth.signInWithPassword({ email: 'troca-sl@e2e.local', password: SENHA })).error).toBeNull();
  // Pelo link de nova senha: o campo da senha atual nem aparece.
  await page.context().clearCookies();
  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email: 'troca-sl@e2e.local' });
  expect(error).toBeNull();
  await page.goto(`/auth/confirm?token_hash=${data.properties!.hashed_token}&type=recovery`);
  await page.waitForURL('**/definir-senha');
  await expect(page.getByLabel('Senha atual')).toHaveCount(0);
  await page.getByLabel('Nova senha').fill('Senha-nova-2026');
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForURL('**/inicio');
  expect((await clientePublico().auth.signInWithPassword({ email: 'troca-sl@e2e.local', password: 'Senha-nova-2026' })).error).toBeNull();
  await apagarPessoas(['troca-sl@e2e.local']);
});
