'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { normalizarTelefone } from '@escritorio/core';
import { comAvisoNaUrl } from '@/lib/avisos';
import { cadastrarContatoPeloTelefone, lerManter } from '@/lib/cadastro-contato';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Cadastra um contato, com ou sem empresa (o vínculo com empresa é feito na ficha dela). */
export async function cadastrarContato(formData: FormData) {
  const u = await obterUsuario();
  if (!temPermissao(u, 'editar_clientes')) throw new Error('Você não tem permissão para cadastrar contatos.');
  const nome = String(formData.get('nome') ?? '').trim();
  const telefone = normalizarTelefone(String(formData.get('telefone') ?? ''));
  if (nome.length < 2) throw new Error('Informe o nome do contato.');
  if (!telefone) throw new Error('Telefone inválido. Use DDD + número, ex.: (31) 99999-0000.');
  const sb = await supabaseServidor();
  // Telefone de contato arquivado traz o contato de volta só com as empresas de antes escolhidas na pergunta.
  const { aviso } = await cadastrarContatoPeloTelefone(sb, { nome, telefone, agentePausado: formData.get('agente_atende') !== 'on', manter: lerManter(formData) });
  revalidatePath('/contatos');
  if (aviso) redirect(comAvisoNaUrl('/contatos', aviso));
}
