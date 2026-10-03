import type { Page } from '@playwright/test';
import { clienteServicoLocal } from './trava-local';

// Só com o Supabase local (trava-local): este cliente cria e apaga pessoas.
export const db = clienteServicoLocal();

export async function criarUsuarioTeste(p: { email: string; senha: string; nome: string; papel: 'admin' | 'atendente'; setores?: string[]; permissoes?: string[] }): Promise<string> {
  const { data: lista } = await db.auth.admin.listUsers();
  const existente = lista.users.find((u) => u.email === p.email);
  if (existente) await db.auth.admin.deleteUser(existente.id);
  const { data, error } = await db.auth.admin.createUser({ email: p.email, password: p.senha, email_confirm: true });
  if (error) throw error;
  const id = data.user.id;
  await db.from('usuarios').insert({ id, nome: p.nome, email: p.email, papel: p.papel, permissoes: p.permissoes ?? [] });
  for (const nome of p.setores ?? []) {
    const { data: s } = await db.from('setores').select('id').eq('nome', nome).single();
    await db.from('usuario_setores').insert({ usuario_id: id, setor_id: s!.id });
  }
  return id;
}

export async function entrar(page: Page, email: string, senha: string): Promise<void> {
  await page.goto('/entrar');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(senha);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL('**/inicio');
}
