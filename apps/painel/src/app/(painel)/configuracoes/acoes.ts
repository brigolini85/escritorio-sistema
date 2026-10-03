'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { exigirAdmin, exigirConfiguracoes } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { esquemaAvisoLogin, ExpedienteForm, PrazosForm, TetoAlertasForm } from './esquemas';

const recarregar = () => revalidatePath('/configuracoes');
function checar(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message);
}

export async function salvarSetor(id: string | null, formData: FormData) {
  await exigirConfiguracoes();
  const sb = await supabaseServidor();
  const dados = { nome: String(formData.get('nome')).trim(), descricao_assuntos: String(formData.get('descricao_assuntos') ?? '').trim(), ativo: formData.get('ativo') !== null || !id };
  checar(id ? await sb.from('setores').update(dados).eq('id', id) : await sb.from('setores').insert(dados));
  recarregar();
}

export async function salvarServico(id: string | null, formData: FormData) {
  await exigirConfiguracoes();
  const sb = await supabaseServidor();
  const dados = { nome: String(formData.get('nome')).trim(), setor_id: String(formData.get('setor_id') || '') || null, ativo: formData.get('ativo') !== null || !id };
  checar(id ? await sb.from('servicos').update(dados).eq('id', id) : await sb.from('servicos').insert(dados));
  recarregar();
}

export async function salvarResposta(formData: FormData) {
  await exigirConfiguracoes();
  const sb = await supabaseServidor();
  checar(await sb.from('respostas_prontas').insert({ pergunta: String(formData.get('pergunta')).trim(), resposta: String(formData.get('resposta')).trim() }));
  recarregar();
}

export async function removerResposta(id: string) {
  await exigirConfiguracoes();
  checar(await (await supabaseServidor()).from('respostas_prontas').delete().eq('id', id));
  recarregar();
}

export async function salvarExpediente(formData: FormData) {
  await exigirConfiguracoes();
  checar(await (await supabaseServidor()).from('configuracoes').update(ExpedienteForm.parse(formData)).eq('id', 1));
  recarregar();
}

/** Teto de IA e alertas: só o administrador (P12); o gatilho configuracoes_so_admin recusa de novo no banco. */
export async function salvarTetoAlertas(formData: FormData) {
  await exigirAdmin();
  checar(await (await supabaseServidor()).from('configuracoes').update(TetoAlertasForm.parse(formData)).eq('id', 1));
  recarregar();
}

export async function adicionarFeriado(formData: FormData) {
  await exigirConfiguracoes();
  checar(await (await supabaseServidor()).from('feriados').upsert({ data: String(formData.get('data')), descricao: String(formData.get('descricao')).trim() }));
  recarregar();
}

export async function removerFeriado(data: string) {
  await exigirConfiguracoes();
  checar(await (await supabaseServidor()).from('feriados').delete().eq('data', data));
  recarregar();
}

export async function salvarMensagens(formData: FormData) {
  await exigirConfiguracoes();
  // Com o agente pausado nada é enviado ao cliente (decisão do dono, 2026-09-28): não há mensagem de pausa.
  const chaves = ['aviso_lgpd', 'fora_do_horario', 'ia_indisponivel'];
  const mensagens = Object.fromEntries(chaves.map((k) => [k, String(formData.get(k) ?? '').trim()]));
  checar(await (await supabaseServidor()).from('configuracoes').update({ mensagens }).eq('id', 1));
  recarregar();
}

export async function salvarAvisoLogin(formData: FormData) {
  await exigirConfiguracoes();
  const dados = esquemaAvisoLogin.safeParse({ aviso_login: String(formData.get('aviso_login') ?? '') });
  if (!dados.success) redirect('/configuracoes?erro=aviso_login#aviso-login');
  checar(await (await supabaseServidor()).from('configuracoes').update({ aviso_login: dados.data.aviso_login }).eq('id', 1));
  recarregar();
}

export async function salvarPrazos(formData: FormData) {
  await exigirConfiguracoes();
  const dados = PrazosForm.safeParse(Object.fromEntries(['prazo_urgente_dias', 'prazo_alta_dias', 'prazo_normal_dias', 'prazo_baixa_dias']
    .map((k) => [k, String(formData.get(k) ?? '')])));
  if (!dados.success) redirect('/configuracoes?erro=prazos#prazos');
  checar(await (await supabaseServidor()).from('configuracoes').update(dados.data).eq('id', 1));
  recarregar();
}
