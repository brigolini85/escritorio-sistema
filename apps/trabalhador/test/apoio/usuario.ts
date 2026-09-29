import { db } from './cenario';

/** Cria (ou recria) um usuário do painel para testes do assistente. */
export async function criarUsuarioTeste(p: { email: string; nome?: string; papel?: 'admin' | 'atendente'; permissoes?: string[]; telefone?: string | null; setores?: string[] }) {
  const antigo = (await db.from('usuarios').select('id').eq('email', p.email).maybeSingle()).data;
  if (antigo) await db.auth.admin.deleteUser(antigo.id);
  const { data } = await db.auth.admin.createUser({ email: p.email, password: 'Senha-teste-123', email_confirm: true });
  const id = data.user!.id;
  await db.from('usuarios').insert({ id, nome: p.nome ?? 'Dono', email: p.email, papel: p.papel ?? 'admin', permissoes: p.permissoes ?? ['assistente_site'], telefone: p.telefone ?? null });
  for (const setor of p.setores ?? []) {
    const { data: s } = await db.from('setores').select('id').eq('nome', setor).single();
    await db.from('usuario_setores').insert({ usuario_id: id, setor_id: s!.id });
  }
  return id;
}
