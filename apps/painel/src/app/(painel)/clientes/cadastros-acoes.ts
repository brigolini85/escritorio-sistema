'use server';
import { revalidatePath } from 'next/cache';
import { caminhoDaEmpresa } from '@escritorio/core';
import { temNivel } from '@/lib/permissoes';
import { exigirAdmin, obterUsuario } from '@/lib/sessao';
import { comAvisoDeErro } from '@/lib/erro-formulario';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { GrupoForm, PrecoForm, ProdutoForm, UnidadeForm } from './cadastros-esquemas';
import { lerSetorDoDocumento, lerSetoresDeDocumento, setoresEscolhiveis } from './documento-setor';

async function exigirEdicao() {
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) throw new Error('Você não tem permissão para editar cadastros.');
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
    if (!temNivel(u, 'precos', 'mudar')) throw new Error('Você não tem permissão para editar preços.');
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
    // Setor e "Tem valores" (H2, D11) só vêm quando o banco tem a migração (o formulário mostra o campo).
    const extra = lerSetorDoDocumento(formData, await setoresDeDocumento(sb, formData));
    if (extra && 'erro' in extra) throw new Error(extra.erro);
    const arquivoNome = arquivo.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
    const path = `clientes/${clienteId}/${Date.now()}-${arquivoNome}`;
    const mime = arquivo.type || 'application/pdf';
    const up = await sb.storage.from('documentos').upload(path, arquivo, { contentType: mime });
    if (up.error) throw new Error(`Falha ao enviar o arquivo: ${up.error.message}`);
    checar(await sb.from('documentos_empresa').insert({ cliente_id: clienteId, nome, arquivo_path: path, arquivo_nome: arquivoNome, arquivo_mime: mime, enviado_por: u.id, ...(extra ?? {}) }));
  });
  revalidatePath(`/clientes/${clienteId}`);
}

/** Setores que um documento pode ganhar: os ativos, menos Direção (D5). Só lê quando o formulário traz o campo; erro lança. */
async function setoresDeDocumento(sb: Awaited<ReturnType<typeof supabaseServidor>>, formData: FormData): Promise<string[]> {
  if (!formData.has('setor_id')) return [];
  return setoresEscolhiveis(await lerSetoresDeDocumento(sb)).map((s) => s.id);
}

/** Setor e "Tem valores" de um documento já enviado (D11). Mesma permissão de mudar o documento. */
export async function definirSetorDocumento(clienteId: string, documentoId: string, formData: FormData) {
  await comAvisoDeErro(aba(clienteId, 'documentos'), async () => {
    const { sb } = await exigirEdicao();
    // O setor que o documento já tem pode ficar, mesmo desativado (nunca vira "da empresa" sem alguém escolher).
    const { data: doc, error } = await sb.from('documentos_empresa').select('setor_id').eq('id', documentoId).eq('cliente_id', clienteId).maybeSingle();
    if (error) throw new Error('Não foi possível ler o documento agora. Tente de novo.');
    if (!doc) throw new Error('Documento não encontrado.');
    const extra = lerSetorDoDocumento(formData, await setoresDeDocumento(sb, formData), doc.setor_id);
    if (!extra) return;
    if ('erro' in extra) throw new Error(extra.erro);
    checar(await sb.from('documentos_empresa').update(extra).eq('id', documentoId).eq('cliente_id', clienteId));
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
  checar(await sb.from('documentos_empresa').delete().eq('id', documentoId).eq('cliente_id', clienteId));
  // Auditoria 6.10: só apaga o arquivo da pasta desta empresa (uma linha antiga apontando para outra não leva o arquivo dela).
  if (doc && caminhoDaEmpresa(clienteId, doc.arquivo_path)) await sb.storage.from('documentos').remove([doc.arquivo_path]);
  else if (doc) console.error('[documentos] arquivo fora da pasta da empresa não foi apagado', documentoId);
  revalidatePath(`/clientes/${clienteId}`);
}
