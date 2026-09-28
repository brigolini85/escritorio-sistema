'use server';
import { revalidatePath } from 'next/cache';
import { normalizarTelefone } from '@escritorio/core';
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
  const { error } = await sb.from('contatos')
    .upsert({ nome, telefone, agente_pausado: formData.get('agente_atende') !== 'on' }, { onConflict: 'telefone' });
  if (error) throw new Error(error.message);
  revalidatePath('/contatos');
}
