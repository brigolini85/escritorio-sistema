'use server';
import { revalidatePath } from 'next/cache';
import { enfileirarEnvio } from '@/lib/fila';
import { obterUsuario, temPermissao } from '@/lib/sessao';
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

async function exigirEdicaoClientes() {
  const u = await obterUsuario();
  if (!temPermissao(u, 'editar_clientes')) throw new Error('Você não tem permissão para cadastrar contatos.');
  return supabaseServidor();
}

/** Cadastra o número da conversa como contato (com ou sem empresa) e liga a conversa a ele. */
export async function cadastrarContatoDaConversa(conversaId: string, formData: FormData) {
  const sb = await exigirEdicaoClientes();
  const nome = String(formData.get('nome') ?? '').trim();
  if (nome.length < 2) throw new Error('Informe o nome do contato.');
  const clienteId = String(formData.get('cliente_id') ?? '') || null;
  const { data: conversa, error: e1 } = await sb.from('conversas').select('telefone').eq('id', conversaId).single();
  if (e1) throw new Error(e1.message);
  const { data: contato, error: e2 } = await sb.from('contatos')
    // Cadastrar de novo um telefone arquivado traz o contato de volta (o gatilho limpa o arquivo).
    .upsert({ nome, telefone: conversa.telefone, ativo: true, agente_pausado: formData.get('agente_atende') !== 'on' }, { onConflict: 'telefone' })
    .select('id').single();
  if (e2) throw new Error(e2.message);
  if (clienteId) {
    const { error } = await sb.from('contato_clientes').upsert({ contato_id: contato.id, cliente_id: clienteId, pode_pedir_nota: formData.get('pode_pedir_nota') === 'on' });
    if (error) throw new Error(error.message);
  }
  await rpc('vincular_contato_conversa', { p_conversa: conversaId, p_contato: contato.id });
  revalidatePath(`/atendimento/${conversaId}`);
}

/** Liga ou desliga o agente só para este contato (desligado: nada automático, vira triagem). */
export async function alternarAgenteContato(contatoId: string, conversaId: string | null, estavaDesligado: boolean) {
  const sb = await exigirEdicaoClientes();
  const { error } = await sb.from('contatos').update({ agente_pausado: !estavaDesligado }).eq('id', contatoId);
  if (error) throw new Error(error.message);
  if (conversaId) revalidatePath(`/atendimento/${conversaId}`);
  revalidatePath('/clientes');
  revalidatePath('/contatos');
}
