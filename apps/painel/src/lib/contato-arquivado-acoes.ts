// apps/painel/src/lib/contato-arquivado-acoes.ts
'use server';
import { normalizarTelefone } from '@escritorio/core';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { lerContatoArquivado, type ConsultaContatoArquivado } from './contato-arquivado';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Antes de cadastrar: o telefone é de um contato arquivado? Devolve as empresas de antes (sem a da ação) para a tela
 * perguntar quais voltam. Só lê; quem grava é cadastrar_contato, que confere tudo de novo.
 */
export async function consultarContatoArquivado(dados: {
  telefone?: string; conversaId?: string; clienteId?: string | null;
}): Promise<ConsultaContatoArquivado> {
  const u = await obterUsuario();
  // Sem permissão a tela segue o caminho de sempre, e o cadastro recusa com a mensagem de hoje.
  if (!temPermissao(u, 'editar_clientes')) return { situacao: 'livre' };
  const sb = await supabaseServidor();
  let telefone: string | null;
  if (dados.conversaId !== undefined) {
    if (!UUID.test(dados.conversaId)) return { situacao: 'livre' };
    const { data } = await sb.from('conversas').select('telefone').eq('id', dados.conversaId).maybeSingle();
    telefone = data?.telefone ?? null;
  } else {
    telefone = normalizarTelefone(dados.telefone ?? '');
  }
  if (!telefone) return { situacao: 'livre' };
  const clienteAtual = dados.clienteId && UUID.test(dados.clienteId) ? dados.clienteId : null;
  const { data, error } = await sb.rpc('contato_arquivado_do_telefone', { p_telefone: telefone });
  if (error) return { situacao: 'erro', erro: error.message };
  let r: ReturnType<typeof lerContatoArquivado>;
  try {
    r = lerContatoArquivado(data, clienteAtual);
  } catch (e) {
    return { situacao: 'erro', erro: (e as Error).message };
  }
  if (r.situacao !== 'arquivado' || r.vinculos.length === 0 || !clienteAtual) return r;
  const { data: c } = await sb.from('clientes').select('razao_social, nome_fantasia').eq('id', clienteAtual).maybeSingle();
  return { ...r, empresaNova: c ? c.nome_fantasia ?? c.razao_social : null };
}
