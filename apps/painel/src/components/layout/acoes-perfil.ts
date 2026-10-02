'use server';
import { cookies } from 'next/headers';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { COOKIE_LETRA, OPCOES_COOKIE_LETRA, tamanhoDoValor, type TamanhoLetra } from './tamanho-letra';

/** Grava o tamanho no perfil (função do banco, só a própria linha) e no cookie lido pelo layout raiz. */
export async function definirTamanhoLetra(t: TamanhoLetra): Promise<{ ok: true } | { ok: false; erro: string }> {
  const tamanho = tamanhoDoValor(t);
  const { error } = await (await supabaseServidor()).rpc('definir_tamanho_letra', { p_tamanho: tamanho });
  if (error) return { ok: false, erro: 'Não deu para guardar o tamanho da letra.' };
  (await cookies()).set(COOKIE_LETRA, tamanho, OPCOES_COOKIE_LETRA);
  return { ok: true };
}
