'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { LIMITES_TAREFA, leituraDoArquivo, mimeDoArquivo } from '@escritorio/core';
import { enfileirarPedidoPendencia, enfileirarTarefa } from '@/lib/fila';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerArquivosDaConversa, lerContatosParaPendencia } from './tarefas';

export type ResultadoTarefaAcao = { ok: true } | { ok: false; erro: string };
const FALHA = 'Não foi possível salvar agora. Tente de novo.';
const Uuid = z.string().uuid();
const NAO_ACHEI = { ok: false as const, erro: 'Tarefa não encontrada.' };

/** Chama a função do banco com a sessão; P0001 é a frase para a pessoa (o banco confere setor, estado e limites). */
async function chamar<T>(nome: string, args: Record<string, unknown>): Promise<{ ok: true; dados: T } | { ok: false; erro: string }> {
  try {
    await obterUsuario();
    const { data, error } = await (await supabaseServidor()).rpc(nome as never, args as never);
    if (error) {
      if (error.code !== 'P0001') console.error(`[tarefas] ${nome}`, error);
      return { ok: false, erro: error.code === 'P0001' ? mensagemDoBanco(error.message) : FALHA };
    }
    return { ok: true, dados: data as T };
  } catch (e) {
    unstable_rethrow(e);
    console.error(`[tarefas] ${nome}`, e);
    return { ok: false, erro: FALHA };
  }
}
/** D8: true do banco = voltou a trabalhar. Se a fila falhar, o batimento do trabalhador enfileira em 2 min. */
async function depois(tarefaId: string, enfileirar: boolean): Promise<void> {
  if (enfileirar) await enfileirarTarefa(tarefaId).catch((e) => console.error('[tarefas] não enfileirada; o batimento tenta', tarefaId, e));
  revalidatePath(`/tarefas/${tarefaId}`);
  revalidatePath('/demandas');
}

export async function criarTarefa(chamadoId: string, agenteId: string, pedido: string, skill: string | null): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  if (!Uuid.safeParse(chamadoId).success || !Uuid.safeParse(agenteId).success) return { ok: false, erro: 'Demanda não encontrada.' };
  const r = await chamar<string>('criar_tarefa_agente', { p_chamado: chamadoId, p_agente: agenteId, p_pedido: pedido, p_skill: skill || null });
  if (!r.ok) return r;
  await depois(r.dados, true);
  return { ok: true, id: r.dados };
}

export async function pausarTarefa(id: string): Promise<ResultadoTarefaAcao> {
  if (!Uuid.safeParse(id).success) return NAO_ACHEI;
  const r = await chamar('pausar_tarefa', { p_id: id });
  if (r.ok) await depois(id, false);
  return r.ok ? { ok: true } : r;
}
export async function continuarTarefa(id: string): Promise<ResultadoTarefaAcao> {
  if (!Uuid.safeParse(id).success) return NAO_ACHEI;
  const r = await chamar<boolean>('continuar_tarefa', { p_id: id });
  if (r.ok) await depois(id, r.dados === true);
  return r.ok ? { ok: true } : r;
}
export async function responderPendencia(tarefaId: string, pendenciaId: string, resposta: string): Promise<ResultadoTarefaAcao> {
  if (!Uuid.safeParse(tarefaId).success || !Uuid.safeParse(pendenciaId).success) return NAO_ACHEI;
  const r = await chamar<boolean>('responder_pendencia', { p_id: pendenciaId, p_resposta: resposta });
  if (r.ok) await depois(tarefaId, r.dados === true);
  return r.ok ? { ok: true } : r;
}
export async function receberPendencia(tarefaId: string, pendenciaId: string, p: { observacao: string; arquivoId?: string | null; mensagemId?: string | null }): Promise<ResultadoTarefaAcao> {
  if (!Uuid.safeParse(tarefaId).success || !Uuid.safeParse(pendenciaId).success) return NAO_ACHEI;
  const r = await chamar<boolean>('receber_pendencia', { p_id: pendenciaId, p_observacao: p.observacao, p_arquivo: p.arquivoId ?? null, p_mensagem: p.mensagemId ?? null });
  if (r.ok) await depois(tarefaId, r.dados === true);
  return r.ok ? { ok: true } : r;
}
export async function pedirAoCliente(tarefaId: string, pendenciaId: string, contatoId: string, texto: string): Promise<ResultadoTarefaAcao> {
  if (!Uuid.safeParse(tarefaId).success || !Uuid.safeParse(pendenciaId).success || !Uuid.safeParse(contatoId).success) return NAO_ACHEI;
  const r = await chamar<number>('pedir_pendencia_ao_cliente', { p_id: pendenciaId, p_contato: contatoId, p_texto: texto });
  if (!r.ok) return r;
  // D7: quem manda é o trabalhador (fila pendencia_cliente), na voz do Thiago.
  await enfileirarPedidoPendencia(pendenciaId, r.dados).catch((e) => console.error('[tarefas] pedido não enfileirado', pendenciaId, e));
  await depois(tarefaId, false);
  return { ok: true };
}
/** Contatos que podem ser procurados e arquivos que o cliente mandou: para as janelas de PEDIR AO CLIENTE e JÁ RECEBI. */
export async function opcoesDaPendenciaCliente(pendenciaId: string): Promise<{ contatos: { id: string; nome: string }[]; arquivos: { mensagemId: string; nome: string; criadoEm: string }[] }> {
  if (!Uuid.safeParse(pendenciaId).success) return { contatos: [], arquivos: [] };
  await obterUsuario();
  const sb = await supabaseServidor();
  const [contatos, arquivos] = await Promise.all([lerContatosParaPendencia(sb, pendenciaId), lerArquivosDaConversa(sb, pendenciaId)]);
  return { contatos, arquivos };
}

/** D14: o arquivo vai ao compartimento "tarefas" com a sessão da pessoa (a regra do Storage confere o setor) e é registrado pela função. */
/** Só recusa de permissão vira a frase do setor; duplicado e tipo recusado têm frase própria; o resto é a falha comum (já registrada no log). */
function erroDoUpload(e: { message?: string; statusCode?: string | number; status?: string | number }): string {
  const codigo = String(e.statusCode ?? e.status ?? '');
  const m = (e.message ?? '').toLowerCase();
  if (codigo === '409' || /already exists|duplicate/.test(m)) return 'Já existe um arquivo com esse nome nesta tarefa.';
  if (codigo === '415' || /mime type|not supported|invalid_mime/.test(m)) return 'Esse tipo de arquivo não é aceito.';
  if (codigo === '401' || codigo === '403' || /row-level security|unauthorized|not authorized|violates/.test(m)) {
    return 'Só quem é do setor da demanda envia arquivo para uma tarefa em andamento.';
  }
  return FALHA;
}

export async function enviarArquivoTarefa(tarefaId: string, dados: FormData): Promise<{ ok: true; arquivoId: string } | { ok: false; erro: string }> {
  if (!Uuid.safeParse(tarefaId).success) return NAO_ACHEI;
  const arquivo = dados.get('arquivo');
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: 'Escolha um arquivo.' };
  if (arquivo.size > LIMITES_TAREFA.arquivoBytes) return { ok: false, erro: 'O arquivo passa de 10 MB.' };
  if (!leituraDoArquivo(arquivo.name)) return { ok: false, erro: 'O agente lê PDF, XML, CSV, TXT, OFX, JPG e PNG.' };
  try {
    await obterUsuario();
    const sb = await supabaseServidor();
    const caminho = `${tarefaId}/${Date.now()}-${arquivo.name.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\w.-]+/g, '_').slice(-80)}`;
    const up = await sb.storage.from('tarefas').upload(caminho, arquivo, { contentType: mimeDoArquivo(arquivo.name) });
    if (up.error) {
      console.error('[tarefas] upload no Storage', tarefaId, up.error);
      return { ok: false, erro: erroDoUpload(up.error) };
    }
    const r = await chamar<string>('registrar_arquivo_tarefa', { p_tarefa: tarefaId, p_caminho: caminho, p_nome: arquivo.name, p_mime: mimeDoArquivo(arquivo.name), p_tamanho: arquivo.size });
    if (!r.ok) {
      // A regra do Storage não deixa a pessoa apagar: quem limpa o envio recusado é o serviço (a função já recusou).
      await supabaseServico().storage.from('tarefas').remove([caminho]).catch(() => {});
      return r;
    }
    await depois(tarefaId, false);
    return { ok: true, arquivoId: r.dados };
  } catch (e) {
    unstable_rethrow(e);
    console.error('[tarefas] envio de arquivo', e);
    return { ok: false, erro: FALHA };
  }
}

export async function aprovarTarefa(id: string): Promise<ResultadoTarefaAcao> {
  if (!Uuid.safeParse(id).success) return NAO_ACHEI;
  const r = await chamar('aprovar_tarefa', { p_id: id });
  if (r.ok) await depois(id, false);
  return r.ok ? { ok: true } : r;
}
export async function pedirAjuste(id: string, texto: string): Promise<ResultadoTarefaAcao> {
  if (!Uuid.safeParse(id).success) return NAO_ACHEI;
  const r = await chamar<boolean>('pedir_ajuste_tarefa', { p_id: id, p_texto: texto });
  if (r.ok) await depois(id, r.dados === true);
  return r.ok ? { ok: true } : r;
}
export async function descartarTarefa(id: string): Promise<ResultadoTarefaAcao> {
  if (!Uuid.safeParse(id).success) return NAO_ACHEI;
  const r = await chamar('descartar_tarefa', { p_id: id });
  if (r.ok) await depois(id, false);
  return r.ok ? { ok: true } : r;
}
