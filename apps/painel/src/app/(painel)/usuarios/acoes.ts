'use server';
import { variantesTelefone } from '@escritorio/core';
import { revalidatePath } from 'next/cache';
import { painelUrl } from '@/lib/ambiente-servidor';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { errosDoBanco, lerFicha, paraBanco, PESSOA_SEM_ACESSO, type EstadoUsuario } from './esquemas';

/** Segurança do login (item 4): sem PAINEL_URL válido nenhum link sai (nada de "undefined/auth/confirm"). */
const SEM_PAINEL_URL = 'O endereço do painel (PAINEL_URL) não está configurado. Fale com quem instalou o sistema.';

function destinoDosLinks(): string | null {
  try {
    return `${painelUrl()}/auth/confirm`;
  } catch (e) {
    console.error('[usuarios] PAINEL_URL', e instanceof Error ? e.message : e);
    return null;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Um telefone é de uma pessoa só: senão o WhatsApp não sabe de quem é a mensagem. Se o dono está nos arquivados,
 * a tela diz isso e oferece restaurar (sobra 4 da Parte B), em vez de um "já é de…" sem saída.
 */
async function conflitoDeTelefone(telefone: string | null, idAtual: string | null): Promise<EstadoUsuario | null> {
  if (!telefone) return null;
  const { data } = await supabaseServico().from('usuarios').select('id, nome, ativo').in('telefone', variantesTelefone(telefone));
  const outro = (data ?? []).find((u) => u.id !== idAtual);
  if (!outro) return null;
  if (outro.ativo) return { ok: false, erros: { telefone: `Este telefone já é de ${outro.nome}.` } };
  return {
    ok: false,
    erros: { telefone: `Este telefone é de ${outro.nome}, que está nos arquivados. Restaure ${outro.nome} ou use outro telefone.` },
    telefoneDeArquivado: { id: outro.id, nome: outro.nome },
  };
}

/** Nova pessoa: convite por e-mail e a ficha gravada pela sessão do administrador (a auditoria registra quem cadastrou). */
export async function convidarUsuario(formData: FormData): Promise<EstadoUsuario> {
  await exigirAdmin();
  const lido = lerFicha(formData);
  if (!lido.ok) return { ok: false, erros: lido.erros };
  const conflito = await conflitoDeTelefone(lido.dados.telefone, null);
  if (conflito) return conflito;
  const destino = destinoDosLinks();
  if (!destino) return { ok: false, erros: { geral: SEM_PAINEL_URL } };
  const servico = supabaseServico();
  const { data, error } = await servico.auth.admin.inviteUserByEmail(lido.dados.email, { redirectTo: destino });
  if (error) return { ok: false, erros: errosDoBanco(error.message, 'convite') };
  const { error: erroFicha } = await (await supabaseServidor()).rpc('salvar_usuario', { p_id: data.user.id, p_dados: paraBanco(lido.dados) as never });
  if (erroFicha) {
    // Sem a ficha, o login do convite não serve e prenderia o e-mail num convite novo.
    const apagado = await servico.auth.admin.deleteUser(data.user.id);
    if (apagado.error) console.error('[usuarios] não consegui apagar o login do convite recusado', data.user.id, apagado.error.message);
    return { ok: false, erros: errosDoBanco(erroFicha.message) };
  }
  revalidatePath('/usuarios');
  return { ok: true, id: data.user.id };
}

export async function salvarUsuario(id: string, formData: FormData): Promise<EstadoUsuario> {
  await exigirAdmin();
  // O id vem do navegador (bind): fora do formato, o banco devolveria um erro cru.
  if (!UUID.test(id)) return { ok: false, erros: { geral: PESSOA_SEM_ACESSO } };
  const lido = lerFicha(formData);
  if (!lido.ok) return { ok: false, erros: lido.erros };
  const conflito = await conflitoDeTelefone(lido.dados.telefone, id);
  if (conflito) return conflito;
  // Sessão do administrador: a auditoria registra quem mudou.
  const { error } = await (await supabaseServidor()).rpc('salvar_usuario', { p_id: id, p_dados: paraBanco(lido.dados) as never });
  if (error) return { ok: false, erros: errosDoBanco(error.message) };
  revalidatePath('/usuarios');
  revalidatePath(`/usuarios/${id}`);
  return { ok: true, id };
}

export type ResultadoConvite = { ok: true; mensagem: string } | { ok: false; erro: string };

/** "reenviar convite": quem nunca entrou recebe o convite de novo; quem já entrou, um link para criar a senha. */
export async function reenviarConvite(id: string): Promise<ResultadoConvite> {
  await exigirAdmin();
  const destino = destinoDosLinks();
  if (!destino) return { ok: false, erro: SEM_PAINEL_URL };
  const servico = supabaseServico();
  const { data, error } = await servico.auth.admin.getUserById(id);
  const email = data?.user?.email;
  if (error || !email) return { ok: false, erro: 'Não encontrei o acesso desta pessoa.' };
  if (!data.user.last_sign_in_at) {
    const convite = await servico.auth.admin.inviteUserByEmail(email, { redirectTo: destino });
    if (!convite.error) return { ok: true, mensagem: `Convite reenviado para ${email}.` };
    console.error('[usuarios] convite não reenviado; mando o link de senha', convite.error.message);
  }
  const { error: erroLink } = await servico.auth.resetPasswordForEmail(email, { redirectTo: destino });
  if (erroLink) return { ok: false, erro: 'Não consegui enviar o e-mail agora. Tente de novo em alguns minutos.' };
  return { ok: true, mensagem: `Enviamos para ${email} um link para criar a senha.` };
}
