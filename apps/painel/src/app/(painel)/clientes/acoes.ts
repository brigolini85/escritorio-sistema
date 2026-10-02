'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { comAvisoNaUrl } from '@/lib/avisos';
import { cadastrarContatoPeloTelefone } from '@/lib/cadastro-contato';
import { enfileirarRemocaoArquivos } from '@/lib/fila';
import { comAvisoDeErro } from '@/lib/erro-formulario';
import { exigirAdmin, obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ClienteForm, ContatoForm } from './esquemas';

async function exigirEdicao() {
  const u = await obterUsuario();
  if (!temPermissao(u, 'editar_clientes')) throw new Error('Você não tem permissão para editar clientes.');
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
  // Telefone de contato arquivado traz o contato de volta só com o vínculo desta empresa (os antigos saem).
  const { id: contatoId, aviso } = await cadastrarContatoPeloTelefone(sb, { nome: c.nome, telefone: c.telefone, clienteId });
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
  checar(await sb.from('cliente_servicos').delete().eq('cliente_id', clienteId));
  if (ids.length) checar(await sb.from('cliente_servicos').insert(ids.map((servico_id) => ({ cliente_id: clienteId, servico_id }))));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function salvarResponsaveis(clienteId: string, formData: FormData) {
  const sb = await exigirEdicao();
  checar(await sb.from('cliente_responsaveis').delete().eq('cliente_id', clienteId));
  const linhas = [...formData.entries()]
    .filter(([k, v]) => k.startsWith('setor:') && v)
    .map(([k, v]) => ({ cliente_id: clienteId, setor_id: k.slice(6), usuario_id: String(v) }));
  if (linhas.length) checar(await sb.from('cliente_responsaveis').insert(linhas));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function anonimizarContato(clienteId: string, contatoId: string, formData: FormData) {
  await exigirAdmin();
  if (formData.get('confirmo') !== 'on') throw new Error('Marque a confirmação para apagar os dados.');
  const sb = await supabaseServidor();
  const { data: paths, error } = await sb.rpc('anonimizar_contato', { p_contato: contatoId });
  if (error) throw new Error(error.message);
  // A remoção dos arquivos vai para a fila do trabalhador, com novas tentativas, para não deixar arquivo órfão.
  await enfileirarRemocaoArquivos(paths ?? []);
  revalidatePath(`/clientes/${clienteId}`);
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
