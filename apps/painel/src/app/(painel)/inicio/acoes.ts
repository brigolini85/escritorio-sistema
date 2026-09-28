'use server';
import { revalidatePath } from 'next/cache';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

export async function alternarPausaGeral(pausar: boolean) {
  await exigirAdmin();
  const { error } = await (await supabaseServidor()).from('configuracoes').update({ agente_pausado: pausar }).eq('id', 1);
  if (error) throw new Error(error.message);
  revalidatePath('/inicio');
}

export async function marcarAlertaLido(id: string) {
  const sb = await supabaseServidor();
  await sb.rpc('marcar_alerta_lido', { p_alerta: id });
  revalidatePath('/inicio');
}
