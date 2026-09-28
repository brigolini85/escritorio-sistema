'use server';
import { revalidatePath } from 'next/cache';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { GrupoForm, UnidadeForm } from './cadastros-esquemas';

async function exigirEdicao() {
  const u = await obterUsuario();
  if (!temPermissao(u, 'editar_clientes')) throw new Error('Você não tem permissão para editar cadastros.');
  return { u, sb: await supabaseServidor() };
}
const campos = (f: FormData) => Object.fromEntries(f.entries());
function checar(r: { error: { message: string } | null }) {
  if (r.error) throw new Error(r.error.message.includes('duplicate') ? 'Já existe um cadastro igual (nome, CNPJ ou código repetido).' : r.error.message);
}

export async function salvarGrupo(clienteId: string, tipo: 'cliente' | 'fornecedor', grupoId: string | null, formData: FormData) {
  const { sb } = await exigirEdicao();
  const dados = GrupoForm.parse({ ativo: grupoId ? undefined : 'on', ...campos(formData) });
  checar(grupoId
    ? await sb.from('parceiros_grupos').update(dados).eq('id', grupoId).eq('cliente_id', clienteId)
    : await sb.from('parceiros_grupos').insert({ ...dados, cliente_id: clienteId, tipo }));
  revalidatePath(`/clientes/${clienteId}`);
}

export async function salvarUnidade(clienteId: string, grupoId: string, unidadeId: string | null, formData: FormData) {
  const { sb } = await exigirEdicao();
  const dados = UnidadeForm.parse({ ativo: unidadeId ? undefined : 'on', ...campos(formData) });
  checar(unidadeId
    ? await sb.from('parceiros_unidades').update(dados).eq('id', unidadeId).eq('cliente_id', clienteId)
    : await sb.from('parceiros_unidades').insert({ ...dados, cliente_id: clienteId, grupo_id: grupoId }));
  revalidatePath(`/clientes/${clienteId}`);
}
