'use server';
import { revalidatePath } from 'next/cache';
import { exigirAdmin, obterUsuario, temPermissao } from '@/lib/sessao';
import { comAvisoDeErro } from '@/lib/erro-formulario';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { GrupoForm, PrecoForm, ProdutoForm, UnidadeForm } from './cadastros-esquemas';

async function exigirEdicao() {
  const u = await obterUsuario();
  if (!temPermissao(u, 'editar_clientes')) throw new Error('Você não tem permissão para editar cadastros.');
  return { u, sb: await supabaseServidor() };
}
const campos = (f: FormData) => Object.fromEntries(f.entries());
function checar(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message.includes('duplicate') ? 'Já existe um cadastro igual (nome, CNPJ ou código repetido). Confira também os arquivados.' : r.error.message);
}

const aba = (clienteId: string, nome: string) => `/clientes/${clienteId}?aba=${nome}`;

export async function salvarGrupo(clienteId: string, tipo: 'cliente' | 'fornecedor', grupoId: string | null, formData: FormData) {
  await comAvisoDeErro(aba(clienteId, tipo === 'cliente' ? 'clientes' : 'fornecedores'), async () => {
    const { sb } = await exigirEdicao();
    const dados = GrupoForm.parse(campos(formData));
    checar(grupoId
      ? await sb.from('parceiros_grupos').update(dados).eq('id', grupoId).eq('cliente_id', clienteId)
      : await sb.from('parceiros_grupos').insert({ ...dados, cliente_id: clienteId, tipo }));
  });
  revalidatePath(`/clientes/${clienteId}`);
}

export async function salvarUnidade(clienteId: string, grupoId: string, unidadeId: string | null, formData: FormData) {
  const sb0 = await supabaseServidor();
  const { data: grupo } = await sb0.from('parceiros_grupos').select('tipo').eq('id', grupoId).maybeSingle();
  await comAvisoDeErro(aba(clienteId, grupo?.tipo === 'fornecedor' ? 'fornecedores' : 'clientes'), async () => {
    const { sb } = await exigirEdicao();
    const dados = UnidadeForm.parse(campos(formData));
    checar(unidadeId
      ? await sb.from('parceiros_unidades').update(dados).eq('id', unidadeId).eq('cliente_id', clienteId)
      : await sb.from('parceiros_unidades').insert({ ...dados, cliente_id: clienteId, grupo_id: grupoId }));
  });
  revalidatePath(`/clientes/${clienteId}`);
}

export async function salvarProduto(clienteId: string, produtoId: string | null, formData: FormData) {
  await comAvisoDeErro(aba(clienteId, 'produtos'), async () => {
    const { sb } = await exigirEdicao();
    const dados = ProdutoForm.parse(campos(formData));
    checar(produtoId
      ? await sb.from('produtos').update(dados).eq('id', produtoId).eq('cliente_id', clienteId)
      : await sb.from('produtos').insert({ ...dados, cliente_id: clienteId }));
  });
  revalidatePath(`/clientes/${clienteId}`);
}

export async function definirPreco(clienteId: string, grupoId: string, produtoId: string, formData: FormData) {
  await comAvisoDeErro(aba(clienteId, 'precos'), async () => {
    const u = await obterUsuario();
    if (!temPermissao(u, 'editar_precos')) throw new Error('Você não tem permissão para editar preços.');
    const { valor } = PrecoForm.parse(campos(formData));
    const sb = await supabaseServidor();
    const { error } = await sb.rpc('definir_preco', { p_grupo: grupoId, p_produto: produtoId, p_valor: valor });
    if (error) throw new Error(error.message);
  });
  revalidatePath(`/clientes/${clienteId}`);
}

export async function enviarDocumento(clienteId: string, formData: FormData) {
  await comAvisoDeErro(aba(clienteId, 'documentos'), async () => {
    const { u, sb } = await exigirEdicao();
    const nome = String(formData.get('nome') ?? '').trim();
    const arquivo = formData.get('arquivo');
    if (!nome || !(arquivo instanceof File) || arquivo.size === 0) throw new Error('Informe o nome e escolha o arquivo.');
    const arquivoNome = arquivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
    const path = `clientes/${clienteId}/${Date.now()}-${arquivoNome}`;
    const mime = arquivo.type || 'application/pdf';
    const up = await sb.storage.from('documentos').upload(path, arquivo, { contentType: mime });
    if (up.error) throw new Error(`Falha ao enviar o arquivo: ${up.error.message}`);
    checar(await sb.from('documentos_empresa').insert({ cliente_id: clienteId, nome, arquivo_path: path, arquivo_nome: arquivoNome, arquivo_mime: mime, enviado_por: u.id }));
  });
  revalidatePath(`/clientes/${clienteId}`);
}

export async function alternarIaDocumento(clienteId: string, documentoId: string, liberar: boolean) {
  const { sb } = await exigirEdicao();
  checar(await sb.from('documentos_empresa').update({ ia_pode_enviar: liberar }).eq('id', documentoId).eq('cliente_id', clienteId));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function excluirDocumento(clienteId: string, documentoId: string) {
  await exigirAdmin();
  const sb = await supabaseServidor();
  const { data: doc } = await sb.from('documentos_empresa').select('arquivo_path').eq('id', documentoId).eq('cliente_id', clienteId).single();
  checar(await sb.from('documentos_empresa').delete().eq('id', documentoId));
  if (doc) await sb.storage.from('documentos').remove([doc.arquivo_path]);
  revalidatePath(`/clientes/${clienteId}`);
}
