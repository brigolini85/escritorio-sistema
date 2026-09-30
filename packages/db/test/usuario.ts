import type { Db } from '../src';

/** Cria (ou recria) um usuário de teste no Auth e em public.usuarios. Devolve o id. */
export async function criarUsuario(db: Db, email: string, extra: object = {}): Promise<string> {
  const antigo = (await db.from('usuarios').select('id').eq('email', email).maybeSingle()).data;
  if (antigo) await db.auth.admin.deleteUser(antigo.id);
  const { data } = await db.auth.admin.createUser({ email, password: 'Senha-teste-123', email_confirm: true });
  await db.from('usuarios').insert({ id: data.user!.id, nome: 'Dono', email, ...extra });
  return data.user!.id;
}
