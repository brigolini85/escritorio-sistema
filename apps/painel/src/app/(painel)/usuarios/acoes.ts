'use server';
import { revalidatePath } from 'next/cache';
import { variantesTelefone } from '@escritorio/core';
import { comAvisoDeErro } from '@/lib/erro-formulario';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { UsuarioForm } from './esquemas';

function checar(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message);
}

/** Um telefone é de uma pessoa só: senão o WhatsApp não sabe de quem é a mensagem. */
async function telefoneLivre(telefone: string | null, idAtual: string | null) {
  if (!telefone) return;
  const { data } = await supabaseServico().from('usuarios').select('id, nome').in('telefone', variantesTelefone(telefone));
  const outro = (data ?? []).find((u) => u.id !== idAtual);
  if (outro) throw new Error(`Este telefone já é de ${outro.nome}.`);
}

export async function convidarUsuario(formData: FormData) {
  await comAvisoDeErro('/usuarios', async () => {
    await exigirAdmin();
    const d = UsuarioForm.parse(formData);
    await telefoneLivre(d.telefone, null);
    const servico = supabaseServico();
    const { data, error } = await servico.auth.admin.inviteUserByEmail(d.email, { redirectTo: `${process.env.PAINEL_URL}/auth/confirm` });
    if (error) throw new Error(`Não foi possível convidar: ${error.message}`);
    checar(await servico.from('usuarios').insert({ id: data.user.id, nome: d.nome, email: d.email, papel: d.papel, telefone: d.telefone, permissoes: d.permissoes }));
    if (d.setores.length) checar(await servico.from('usuario_setores').insert(d.setores.map((setor_id) => ({ usuario_id: data.user.id, setor_id }))));
  });
  revalidatePath('/usuarios');
}

export async function salvarUsuario(id: string, formData: FormData) {
  await comAvisoDeErro('/usuarios', async () => {
    await exigirAdmin();
    const d = UsuarioForm.parse(formData);
    await telefoneLivre(d.telefone, id);
    // Sessão do administrador (o RLS escrita_admin permite): a auditoria registra quem mudou, em vez de ficar sem usuário.
    const sb = await supabaseServidor();
    checar(await sb.from('usuarios').update({ nome: d.nome, papel: d.papel, telefone: d.telefone, permissoes: d.permissoes }).eq('id', id));
    checar(await sb.from('usuario_setores').delete().eq('usuario_id', id));
    if (d.setores.length) checar(await sb.from('usuario_setores').insert(d.setores.map((setor_id) => ({ usuario_id: id, setor_id }))));
  });
  revalidatePath('/usuarios');
}
