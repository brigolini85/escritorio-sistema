'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prepararAnexoResposta } from '@/lib/arquivo-envio';
import { comAvisoNaUrl } from '@/lib/avisos';
import { cadastrarContatoPeloTelefone, lerManter } from '@/lib/cadastro-contato';
import { enfileirarEnvio, enfileirarSugestao } from '@/lib/fila';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { lerDadosNovaDemanda, type DadosNovaDemanda } from '@/lib/nova-demanda-dados';
import { temNivel, usaAssistente } from '@/lib/permissoes';
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

export type Resultado = { ok: true; mensagem: string } | { ok: false; erro: string };

/** Concluir o atendimento humano (P6): devolve ao agente e vai para "Concluídas hoje". Demandas não mudam. */
export async function concluirAtendimento(conversaId: string) {
  await rpc('concluir_conversa', { p_conversa: conversaId });
  revalidatePath(`/atendimento/${conversaId}`);
  revalidatePath('/atendimento');
}

/** Trocar a empresa da conversa (spec 7A.2): só entre as do contato; o banco confere e audita. */
export async function trocarEmpresa(conversaId: string, clienteId: string): Promise<Resultado> {
  await obterUsuario();
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('trocar_empresa_conversa', { p_conversa: conversaId, p_cliente: clienteId });
  if (error) return { ok: false, erro: mensagemDoBanco(error.message) };
  revalidatePath(`/atendimento/${conversaId}`);
  revalidatePath('/atendimento');
  return { ok: true, mensagem: `Conversa agora em ${(data as { empresa: string }).empresa}.` };
}

export async function responder(conversaId: string, formData: FormData) {
  const texto = String(formData.get('texto') ?? '').trim();
  const arquivo = formData.get('arquivo');
  let path: string | null = null;
  let nome: string | null = null;
  let mime: string | null = null;
  if (arquivo instanceof File && arquivo.size > 0) {
    const sb = await supabaseServidor();
    // Auditoria 6.9: tipo fora da lista do compartimento sobe como application/octet-stream; a mensagem guarda o original.
    const anexo = prepararAnexoResposta(conversaId, arquivo.name, arquivo.type);
    ({ nome, mime, path } = anexo);
    // Os bytes, não o File: com File o Storage usa o tipo do navegador e ignora o contentType.
    const { error } = await sb.storage.from('anexos').upload(path, await arquivo.arrayBuffer(), { contentType: anexo.contentType });
    if (error) throw new Error(`Falha ao enviar o arquivo: ${error.message}`);
  }
  if (!texto && !path) return;
  const mensagemId = (await rpc('registrar_resposta', {
    p_conversa: conversaId, p_texto: texto || null, p_arquivo_path: path, p_arquivo_nome: nome, p_arquivo_mime: mime,
  })) as string;
  // A resposta já está gravada ("pendente"): se a fila falhar, o batimento do trabalhador reenfileira em 2 minutos.
  // Erro aqui faria a pessoa reenviar o texto e o cliente receber duas vezes; por isso só avisa.
  const naFila = await enfileirarEnvio(mensagemId).then(() => true, (e: unknown) => {
    console.error('[atendimento] enfileirar envio falhou; o batimento tenta de novo:', mensagemId, e);
    return false;
  });
  revalidatePath(`/atendimento/${conversaId}`);
  if (!naFila) redirect(comAvisoNaUrl(`/atendimento/${conversaId}`, 'resposta-na-fila'));
}

/**
 * Auditoria 3.3: a resposta "Não confirmada" (a Z-API pode ter entregado) não sai de novo sozinha; a pessoa confere no
 * WhatsApp e, se precisar, pede "Enviar de novo". O banco só aceita resposta do painel incerta de conversa que ela vê;
 * o segundo clique (já pendente ou enviada) não faz nada.
 */
export async function enviarDeNovo(mensagemId: string, conversaId: string) {
  await obterUsuario();
  const sb = await supabaseServidor();
  const { error } = await sb.rpc('reenviar_resposta', { p_mensagem: mensagemId });
  if (error) {
    console.error('[atendimento] enviar de novo recusado:', mensagemId, error.message);
    revalidatePath(`/atendimento/${conversaId}`);
    return;
  }
  // Pendente de novo: se a fila falhar, o batimento do trabalhador reenfileira em 2 minutos.
  const naFila = await enfileirarEnvio(mensagemId).then(() => true, (e: unknown) => {
    console.error('[atendimento] enfileirar envio falhou; o batimento tenta de novo:', mensagemId, e);
    return false;
  });
  revalidatePath(`/atendimento/${conversaId}`);
  if (!naFila) redirect(comAvisoNaUrl(`/atendimento/${conversaId}`, 'resposta-na-fila'));
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
  if (!temNivel(u, 'clientes', 'editar')) throw new Error('Você não tem permissão para cadastrar contatos.');
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
  // Telefone de contato arquivado traz o contato de volta com a empresa escolhida aqui e as de antes marcadas na pergunta.
  const r = await cadastrarContatoPeloTelefone(sb, {
    nome, telefone: conversa.telefone, clienteId, agentePausado: formData.get('agente_atende') !== 'on', manter: lerManter(formData),
  });
  // Recusa do banco: o aviso vermelho da conversa (?erro=), que a página já mostra.
  if ('erro' in r) redirect(`/atendimento/${conversaId}?erro=${encodeURIComponent(r.erro)}`);
  const { id: contatoId, aviso } = r;
  if (clienteId) {
    const { error } = await sb.from('contato_clientes').upsert({ contato_id: contatoId, cliente_id: clienteId, pode_pedir_nota: formData.get('pode_pedir_nota') === 'on' });
    if (error) throw new Error(error.message);
  }
  await rpc('vincular_contato_conversa', { p_conversa: conversaId, p_contato: contatoId });
  revalidatePath(`/atendimento/${conversaId}`);
  if (aviso) redirect(comAvisoNaUrl(`/atendimento/${conversaId}`, aviso));
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

/** Sugerir resposta (spec 7A.1): grava o pedido (o banco confere assistente, acesso e horário) e põe na fila. Nada vai à conversa. */
export async function pedirSugestao(conversaId: string): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const u = await obterUsuario();
  if (!usaAssistente(u, 'site')) return { ok: false, erro: 'Sugerir resposta usa o assistente: peça acesso ao administrador.' };
  const sb = await supabaseServidor();
  const { data, error } = await sb.rpc('pedir_sugestao_resposta', { p_conversa: conversaId });
  if (error) return { ok: false, erro: mensagemDoBanco(error.message) };
  try {
    await enfileirarSugestao(data as string);
  } catch {
    return { ok: false, erro: 'Não consegui pedir a sugestão agora. Tente de novo em 2 minutos.' };
  }
  return { ok: true, id: data as string };
}

export type LeituraSugestao = { status: 'pendente' | 'pronta' | 'falhou' | 'erro'; texto: string | null; erro: string | null };

/** Estado do pedido de sugestão (a tabela não está no Realtime: o painel pergunta a cada poucos segundos). Só quem pediu lê (RLS). */
export async function lerSugestao(id: string): Promise<LeituraSugestao | null> {
  await obterUsuario();
  const sb = await supabaseServidor();
  const { data, error } = await sb.from('sugestoes_resposta').select('status, texto, erro').eq('id', id).maybeSingle();
  // Erro do banco (fora do horário, sessão vencida): não é "pendente"; o painel mostra o motivo depois de algumas tentativas.
  if (error) return { status: 'erro', texto: null, erro: mensagemDoBanco(error.message) };
  return data ? { status: data.status as LeituraSugestao['status'], texto: data.texto, erro: data.erro } : null;
}

/** Dados do painel "Nova demanda" para esta conversa: só as empresas do contato (ou a da conversa), com elas já escolhidas. */
export async function dadosAbrirDemanda(conversaId: string): Promise<(DadosNovaDemanda & { inicial: { cliente: string; contato: string } }) | { erro: string }> {
  const u = await obterUsuario();
  const sb = await supabaseServidor();
  const { data: c } = await sb.from('conversas').select('cliente_em_foco, contato_id').eq('id', conversaId).maybeSingle();
  if (!c) return { erro: 'Sem acesso a esta conversa.' };
  const { data: vinculos } = c.contato_id
    ? await sb.from('contato_clientes').select('cliente_id').eq('contato_id', c.contato_id)
    : { data: [] as { cliente_id: string }[] };
  const ids = [...new Set([...(c.cliente_em_foco ? [c.cliente_em_foco] : []), ...(vinculos ?? []).map((v) => v.cliente_id)])];
  if (ids.length === 0) return { erro: 'Cadastre o contato e a empresa antes de abrir uma demanda.' };
  const dados = await lerDadosNovaDemanda(sb, u, ids);
  if (dados.setores.length === 0) return { erro: 'Você não tem setor para abrir demanda.' };
  if (dados.empresas.length === 0) return { erro: 'Cadastre o contato e a empresa antes de abrir uma demanda.' };
  const cliente = c.cliente_em_foco && dados.empresas.some((e) => e.id === c.cliente_em_foco) ? c.cliente_em_foco : dados.empresas[0]!.id;
  // O contato só vem escolhido se fala por esta empresa (senão a lista de contatos dela não o teria).
  const ligado = Boolean(c.contato_id) && (vinculos ?? []).some((v) => v.cliente_id === cliente);
  return { ...dados, inicial: { cliente, contato: ligado ? c.contato_id! : '' } };
}
