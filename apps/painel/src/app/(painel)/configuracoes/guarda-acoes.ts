'use server';

import { revalidatePath } from 'next/cache';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

const PRAZOS = new Set([90, 180, 365, 730]);
/** D14: só o dono (o banco confere). */
export async function salvarGuardaTarefas(dias: number | null): Promise<{ ok: true } | { ok: false; erro: string }> {
  await obterUsuario();
  if (dias !== null && !PRAZOS.has(dias)) return { ok: false, erro: 'Escolha 90, 180, 365 ou 730 dias, ou nunca apagar.' };
  const { error } = await (await supabaseServidor()).rpc('salvar_guarda_tarefas', { p_dias: dias as number });
  if (error) {
    if (error.code === 'P0001') return { ok: false, erro: error.message };
    console.error('[guarda] salvar', error.code, error.message);
    return { ok: false, erro: 'Não consegui salvar agora. Tente de novo.' };
  }
  revalidatePath('/configuracoes');
  return { ok: true };
}
