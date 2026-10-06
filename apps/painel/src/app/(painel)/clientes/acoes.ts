'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { registrarAuditoria } from '@/lib/auditoria';
import { comAvisoNaUrl } from '@/lib/avisos';
import { cadastrarContatoPeloTelefone, lerManter } from '@/lib/cadastro-contato';
import { enfileirarRemocaoArquivos } from '@/lib/fila';
import { comAvisoDeErro } from '@/lib/erro-formulario';
import { temNivel } from '@/lib/permissoes';
import { exigirAdmin, obterUsuario } from '@/lib/sessao';
import { supabaseServico } from '@/lib/supabase/servico';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ClienteForm, ContatoForm } from './esquemas';

async function exigirEdicao() {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) throw new Error('Você não tem permissão para editar clientes.');
  return supabaseServidor();
}
const campos = (f: FormData) => Object.fromEntries(f.entries());
/** Erro do banco (inclusive recusa por permissão) aparece na tela em vez de passar calado. */
function checar(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message);
}

export async function salvarCliente(id: string | null, formData: FormData) {
  await comAvisoDeErro(id ? `/clientes/${id}?aba=dados` : '/clientes/novo', () => salvarClienteSemAviso(id, formData));
}

async function salvarClienteSemAviso(id: string | null, formData: FormData) {
  const sb = await exigirEdicao();
  const u = await obterUsuario();
  const dados = ClienteForm.parse(campos(formData));
  // Pausar o agente é decisão só do administrador (spec, seção 5).
  const pausa = u.papel === 'admin' ? { agente_pausado: formData.get('agente_pausado') === 'on' } : {};
  if (id) {
    const { error } = await sb.from('clientes').update({ ...dados, ...pausa }).eq('id', id);
    if (error) throw new Error(error.message);
    revalidatePath(`/clientes/${id}`);
    return;
  }
  const { data, error } = await sb.from('clientes').insert(dados).select('id').single();
  if (error) {
    if (!error.message.includes('duplicate')) throw new Error(error.message);
    // CNPJ é único também entre os arquivados: aponta o caminho em vez de um "já existe" sem saída.
    const { data: arquivado } = await sb.from('clientes').select('id').eq('cnpj', dados.cnpj).eq('ativo', false).maybeSingle();
    throw new Error(arquivado ? 'Este CNPJ é de um cliente arquivado. Restaure em Clientes › Arquivados.' : 'Já existe cliente com este CNPJ.');
  }
  redirect(`/clientes/${data.id}`);
}

export async function adicionarContato(clienteId: string, formData: FormData) {
  await comAvisoDeErro(`/clientes/${clienteId}?aba=contatos`, () => adicionarContatoSemAviso(clienteId, formData));
}

async function adicionarContatoSemAviso(clienteId: string, formData: FormData) {
  const sb = await exigirEdicao();
  const c = ContatoForm.parse(campos(formData));
  // Telefone de contato arquivado traz o contato de volta com esta empresa e as de antes escolhidas na pergunta.
  const { id: contatoId, aviso } = await cadastrarContatoPeloTelefone(sb, { nome: c.nome, telefone: c.telefone, clienteId, manter: lerManter(formData) });
  const { error: e2 } = await sb.from('contato_clientes').upsert({
    contato_id: contatoId, cliente_id: clienteId, pode_pedir_nota: c.pode_pedir_nota, pode_atualizar_preco: c.pode_atualizar_preco,
  });
  if (e2) throw new Error(e2.message);
  revalidatePath(`/clientes/${clienteId}`);
  if (aviso) redirect(comAvisoNaUrl(`/clientes/${clienteId}?aba=contatos`, aviso));
}

export async function removerContato(clienteId: string, contatoId: string) {
  const sb = await exigirEdicao();
  checar(await sb.from('contato_clientes').delete().eq('cliente_id', clienteId).eq('contato_id', contatoId));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function salvarServicos(clienteId: string, formData: FormData) {
  const sb = await exigirEdicao();
  const ids = formData.getAll('servico').map(String);
  // Uma chamada só (uma transação): se falhar, os serviços de antes ficam (revisão geral, painel I7).
  checar(await sb.rpc('salvar_servicos_cliente', { p_cliente: clienteId, p_servicos: ids }));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function salvarResponsaveis(clienteId: string, formData: FormData) {
  const sb = await exigirEdicao();
  const responsaveis = Object.fromEntries([...formData.entries()]
    .filter(([k, v]) => k.startsWith('setor:') && v)
    .map(([k, v]) => [k.slice(6), String(v)]));
  checar(await sb.rpc('salvar_responsaveis_cliente', { p_cliente: clienteId, p_responsaveis: responsaveis }));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function anonimizarContato(clienteId: string, contatoId: string, formData: FormData): Promise<{ aviso: string } | undefined> {
  const u = await exigirAdmin();
  if (formData.get('confirmo') !== 'on') throw new Error('Marque a confirmação para apagar os dados.');
  const sb = await supabaseServidor();
  const { data: paths, error } = await sb.rpc('anonimizar_contato', { p_contato: contatoId });
  if (error) throw new Error(error.message);
  revalidatePath(`/clientes/${clienteId}`);
  const caminhos = paths ?? [];
  // A remoção dos arquivos vai para a fila do trabalhador, com novas tentativas, para não deixar arquivo órfão.
  try {
    await enfileirarRemocaoArquivos(caminhos);
    return undefined;
  } catch (e) {
    // Revisão geral (painel I6): o banco já apagou; repetir a ação não traz os caminhos de volta. Tenta remover agora e,
    // o que sobrar, fica registrado (auditoria "remocao_pendente", com os caminhos) e a pessoa é avisada.
    console.error('[lgpd] fila de remoção fora; removendo na hora', e);
    const restantes = await removerArquivosAgora(caminhos);
    if (!restantes.length) return undefined;
    console.error('[lgpd] arquivos ainda não removidos', { contatoId, paths: restantes });
    await registrarAuditoria(u.id, 'remocao_pendente', 'arquivos_lgpd', contatoId, { paths: restantes });
    return { aviso: `Os dados foram apagados, mas ${restantes.length} arquivo(s) ainda não saíram do armazenamento. Ficou registrado para remover; avise o suporte.` };
  }
}

/** Mesma divisão do trabalhador (midia/remocao.ts): "conversas/..." é do compartimento "anexos"; o resto, de "tarefas". Devolve o que não saiu. */
async function removerArquivosAgora(paths: string[]): Promise<string[]> {
  const grupos = [
    { bucket: 'anexos', paths: paths.filter((p) => p.startsWith('conversas/')) },
    { bucket: 'tarefas', paths: paths.filter((p) => !p.startsWith('conversas/')) },
  ].filter((g) => g.paths.length);
  const sobras = await Promise.all(grupos.map(async (g) => {
    try {
      const { error } = await supabaseServico().storage.from(g.bucket).remove(g.paths);
      return error ? g.paths : [];
    } catch {
      return g.paths;
    }
  }));
  return sobras.flat();
}

/** Liga à empresa um contato que já existe (cadastrado pela aba Contatos ou pela conversa). */
export async function vincularContatoExistente(clienteId: string, formData: FormData) {
  await comAvisoDeErro(`/clientes/${clienteId}?aba=contatos`, () => vincularContatoSemAviso(clienteId, formData));
}

async function vincularContatoSemAviso(clienteId: string, formData: FormData) {
  const sb = await exigirEdicao();
  const contatoId = String(formData.get('contato_id') ?? '');
  if (!contatoId) throw new Error('Escolha o contato.');
  checar(await sb.from('contato_clientes').upsert({
    contato_id: contatoId, cliente_id: clienteId,
    pode_pedir_nota: formData.get('pode_pedir_nota') === 'on', pode_atualizar_preco: formData.get('pode_atualizar_preco') === 'on',
  }));
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath('/contatos');
}
