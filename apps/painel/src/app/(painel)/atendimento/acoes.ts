'use server';
import { revalidatePath } from 'next/cache';
import { enfileirarEnvio } from '@/lib/fila';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

async function rpc(nome: string, args: Record<string, unknown>) {
  await obterUsuario();
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc(nome as never, args as never);
  if (error) throw new Error(error.message);
  return data as unknown;
}

export async function assumir(conversaId: string) {
  await rpc('assumir_conversa', { p_conversa: conversaId });
  revalidatePath(`/atendimento/${conversaId}`);
}

export async function devolverAoAgente(conversaId: string) {
  await rpc('devolver_ao_agente', { p_conversa: conversaId });
  revalidatePath(`/atendimento/${conversaId}`);
}

export async function responder(conversaId: string, formData: FormData) {
  const texto = String(formData.get('texto') ?? '').trim();
  const arquivo = formData.get('arquivo');
  let path: string | null = null;
  let nome: string | null = null;
  let mime: string | null = null;
  if (arquivo instanceof File && arquivo.size > 0) {
    const sb = await supabaseServidor();
    nome = arquivo.name;
    mime = arquivo.type || 'application/octet-stream';
    path = `conversas/${conversaId}/${Date.now()}-${nome.replace(/[^\w.-]+/g, '_')}`;
    const { error } = await sb.storage.from('anexos').upload(path, arquivo, { contentType: mime });
    if (error) throw new Error(`Falha ao enviar o arquivo: ${error.message}`);
  }
  if (!texto && !path) return;
  const mensagemId = (await rpc('registrar_resposta', {
    p_conversa: conversaId, p_texto: texto || null, p_arquivo_path: path, p_arquivo_nome: nome, p_arquivo_mime: mime,
  })) as string;
  await enfileirarEnvio(mensagemId);
  revalidatePath(`/atendimento/${conversaId}`);
}

export async function notaInterna(chamadoId: string, conversaId: string, formData: FormData) {
  const texto = String(formData.get('texto') ?? '').trim();
  if (!texto) return;
  await rpc('nota_interna', { p_chamado: chamadoId, p_texto: texto });
  revalidatePath(`/atendimento/${conversaId}`);
}

export async function transferir(chamadoId: string, conversaId: string, formData: FormData) {
  const setor = String(formData.get('setor_id') ?? '');
  const responsavel = String(formData.get('responsavel_id') ?? '') || null;
  await rpc('transferir_chamado', { p_chamado: chamadoId, p_setor: setor, p_responsavel: responsavel });
  revalidatePath(`/atendimento/${conversaId}`);
}

export async function alterarStatus(chamadoId: string, conversaId: string, status: 'em_andamento' | 'aguardando_cliente') {
  await rpc('alterar_status_chamado', { p_chamado: chamadoId, p_status: status });
  revalidatePath(`/atendimento/${conversaId}`);
}

export async function concluir(chamadoId: string, conversaId: string) {
  await rpc('concluir_chamado', { p_chamado: chamadoId });
  revalidatePath(`/atendimento/${conversaId}`);
}
