'use server';
import { revalidatePath } from 'next/cache';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { GeraisForm, UsuarioConvite } from './esquemas';

const recarregar = () => revalidatePath('/configuracoes');
function checar(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message);
}

export async function convidarUsuario(formData: FormData) {
  await exigirAdmin();
  const d = UsuarioConvite.parse(formData);
  const servico = supabaseServico();
  const { data, error } = await servico.auth.admin.inviteUserByEmail(d.email, { redirectTo: `${process.env.PAINEL_URL}/auth/confirm` });
  if (error) throw new Error(`Não foi possível convidar: ${error.message}`);
  checar(await servico.from('usuarios').insert({ id: data.user.id, nome: d.nome, email: d.email, papel: d.papel, telefone: d.telefone, permissoes: d.permissoes }));
  if (d.setores.length) checar(await servico.from('usuario_setores').insert(d.setores.map((setor_id) => ({ usuario_id: data.user.id, setor_id }))));
  recarregar();
}

export async function salvarUsuario(id: string, formData: FormData) {
  await exigirAdmin();
  const d = UsuarioConvite.parse(formData);
  const sb = await supabaseServidor();
  checar(await sb.from('usuarios').update({ nome: d.nome, papel: d.papel, telefone: d.telefone, permissoes: d.permissoes, ativo: formData.get('ativo') === 'on' }).eq('id', id));
  checar(await sb.from('usuario_setores').delete().eq('usuario_id', id));
  if (d.setores.length) checar(await sb.from('usuario_setores').insert(d.setores.map((setor_id) => ({ usuario_id: id, setor_id }))));
  recarregar();
}

export async function salvarSetor(id: string | null, formData: FormData) {
  await exigirAdmin();
  const sb = await supabaseServidor();
  const dados = { nome: String(formData.get('nome')).trim(), descricao_assuntos: String(formData.get('descricao_assuntos') ?? '').trim(), ativo: formData.get('ativo') !== null || !id };
  checar(id ? await sb.from('setores').update(dados).eq('id', id) : await sb.from('setores').insert(dados));
  recarregar();
}

export async function salvarServico(id: string | null, formData: FormData) {
  await exigirAdmin();
  const sb = await supabaseServidor();
  const dados = { nome: String(formData.get('nome')).trim(), setor_id: String(formData.get('setor_id') || '') || null, ativo: formData.get('ativo') !== null || !id };
  checar(id ? await sb.from('servicos').update(dados).eq('id', id) : await sb.from('servicos').insert(dados));
  recarregar();
}

export async function salvarResposta(formData: FormData) {
  await exigirAdmin();
  const sb = await supabaseServidor();
  checar(await sb.from('respostas_prontas').insert({ pergunta: String(formData.get('pergunta')).trim(), resposta: String(formData.get('resposta')).trim() }));
  recarregar();
}

export async function removerResposta(id: string) {
  await exigirAdmin();
  checar(await (await supabaseServidor()).from('respostas_prontas').delete().eq('id', id));
  recarregar();
}

export async function salvarGerais(formData: FormData) {
  await exigirAdmin();
  checar(await (await supabaseServidor()).from('configuracoes').update(GeraisForm.parse(formData)).eq('id', 1));
  recarregar();
}

export async function adicionarFeriado(formData: FormData) {
  await exigirAdmin();
  checar(await (await supabaseServidor()).from('feriados').upsert({ data: String(formData.get('data')), descricao: String(formData.get('descricao')).trim() }));
  recarregar();
}

export async function removerFeriado(data: string) {
  await exigirAdmin();
  checar(await (await supabaseServidor()).from('feriados').delete().eq('data', data));
  recarregar();
}

export async function salvarMensagens(formData: FormData) {
  await exigirAdmin();
  const chaves = ['aviso_lgpd', 'fora_do_horario', 'agente_pausado', 'ia_indisponivel'];
  const mensagens = Object.fromEntries(chaves.map((k) => [k, String(formData.get(k) ?? '').trim()]));
  checar(await (await supabaseServidor()).from('configuracoes').update({ mensagens }).eq('id', 1));
  recarregar();
}
