import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { criarUsuarioTeste, db, entrar } from './apoio';
import { elevarSessao } from './apoio-mfa';
import { exigirBancoLocal } from './trava-local';import { apagarPessoas } from './apoio-sessao';


// Segurança do login (item 9): arquivar a pessoa encerra a sessão dela (não fica só o banco recusando).
const SENHA = 'senha-forte-123';

test.afterAll(async () => { await apagarPessoas(['bia-arq@e2e.local', 'admin-arq@e2e.local']); });

test('pessoa logada é arquivada: a próxima tela pede login, e restaurar não devolve a sessão antiga', async ({ page }) => {
  const bia = await criarUsuarioTeste({ email: 'bia-arq@e2e.local', senha: SENHA, nome: 'Bia Sessão Encerrada', papel: 'atendente', setores: ['Fiscal'] });
  await criarUsuarioTeste({ email: 'admin-arq@e2e.local', senha: SENHA, nome: 'Admin Sessão Encerrada', papel: 'admin' });
  await entrar(page, 'bia-arq@e2e.local', SENHA);

  // O administrador arquiva pela mesma função do painel (com a sessão dele e o segundo fator).
  exigirBancoLocal(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!, { auth: { persistSession: false } });
  expect((await admin.auth.signInWithPassword({ email: 'admin-arq@e2e.local', password: SENHA })).error).toBeNull();
  await elevarSessao(admin, 'admin-arq@e2e.local');
  expect((await admin.rpc('arquivar_cadastro', { p_tipo: 'usuario', p_id: bia })).error).toBeNull();

  await page.goto('/demandas');
  await expect(page).toHaveURL(/\/entrar$/);

  // Restaurada, a pessoa entra de novo com a senha; o cookie antigo não serve mais.
  expect((await admin.rpc('restaurar_cadastro', { p_tipo: 'usuario', p_id: bia })).error).toBeNull();
  await page.goto('/demandas');
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await db.from('usuarios').select('ativo').eq('id', bia).single()).data!.ativo).toBe(true);
});
