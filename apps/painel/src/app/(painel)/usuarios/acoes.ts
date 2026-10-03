'use server';
import { revalidatePath } from 'next/cache';
import { variantesTelefone } from '@escritorio/core';
import { mensagemDeErro } from '@/lib/erro-formulario';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { errosDoFormulario, UsuarioForm, type EstadoUsuario } from './esquemas';

function checar(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message);
}

/** Um telefone é de uma pessoa só: senão o WhatsApp não sabe de quem é a mensagem. */
async function conflitoDeTelefone(telefone: string | null, idAtual: string | null): Promise<EstadoUsuario | null> {
  if (!telefone) return null;
  const { data } = await supabaseServico().from('usuarios').select('id, nome').in('telefone', variantesTelefone(telefone));
  const outro = (data ?? []).find((u) => u.id !== idAtual);
  return outro ? { ok: false, erros: { telefone: `Este telefone já é de ${outro.nome}.` } } : null;
}

export async function convidarUsuario(formData: FormData): Promise<EstadoUsuario> {
  await exigirAdmin();
  const lido = UsuarioForm.safeParse(formData);
  if (!lido.success) return { ok: false, erros: errosDoFormulario(lido.error.issues) };
  const d = lido.data;
  const conflito = await conflitoDeTelefone(d.telefone, null);
  if (conflito) return conflito;
  try {
    const servico = supabaseServico();
    const { data, error } = await servico.auth.admin.inviteUserByEmail(d.email, { redirectTo: `${process.env.PAINEL_URL}/auth/confirm` });
    if (error) throw new Error(`Não foi possível convidar: ${error.message}`);
    checar(await servico.from('usuarios').insert({ id: data.user.id, nome: d.nome, email: d.email, papel: d.papel, telefone: d.telefone, permissoes: d.permissoes }));
    if (d.setores.length) checar(await servico.from('usuario_setores').insert(d.setores.map((setor_id) => ({ usuario_id: data.user.id, setor_id }))));
  } catch (e) {
    return { ok: false, erros: { geral: mensagemDeErro(e) } };
  }
  revalidatePath('/usuarios');
  return { ok: true };
}

export async function salvarUsuario(id: string, formData: FormData): Promise<EstadoUsuario> {
  await exigirAdmin();
  const lido = UsuarioForm.safeParse(formData);
  if (!lido.success) return { ok: false, erros: errosDoFormulario(lido.error.issues) };
  const d = lido.data;
  const conflito = await conflitoDeTelefone(d.telefone, id);
  if (conflito) return conflito;
  try {
    // Sessão do administrador (o RLS escrita_admin permite): a auditoria registra quem mudou, em vez de ficar sem usuário.
    const sb = await supabaseServidor();
    checar(await sb.from('usuarios').update({ nome: d.nome, papel: d.papel, telefone: d.telefone, permissoes: d.permissoes }).eq('id', id));
    checar(await sb.from('usuario_setores').delete().eq('usuario_id', id));
    if (d.setores.length) checar(await sb.from('usuario_setores').insert(d.setores.map((setor_id) => ({ usuario_id: id, setor_id }))));
  } catch (e) {
    return { ok: false, erros: { geral: mensagemDeErro(e) } };
  }
  revalidatePath('/usuarios');
  return { ok: true };
}
