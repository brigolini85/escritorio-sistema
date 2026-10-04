'use server';
import { revalidatePath } from 'next/cache';
import { exigirAdmin } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { UUID } from '../clientes/ficha/ficha';

const FALHA = 'Não consegui salvar agora. Tente de novo.';

/** "Ver acessos de portais" (D3, D4): só o administrador; grava na hora e a auditoria de usuarios registra quem deu. */
export async function definirVerAcessos(id: string, pode: boolean): Promise<{ ok: true } | { ok: false; erro: string }> {
  await exigirAdmin();
  if (typeof id !== 'string' || !UUID.test(id)) return { ok: false, erro: 'Pessoa não encontrada.' };
  if (typeof pode !== 'boolean') return { ok: false, erro: FALHA };
  const { error } = await (await supabaseServidor()).rpc('definir_ver_acessos', { p_usuario: id, p_pode: pode });
  if (error) {
    // Só a recusa da função (P0001) com texto conhecido chega à tela.
    const conhecida = (error.code === undefined || error.code === 'P0001') && error.message === 'Pessoa não encontrada.';
    return { ok: false, erro: conhecida ? error.message : FALHA };
  }
  revalidatePath(`/usuarios/${id}`);
  return { ok: true };
}
