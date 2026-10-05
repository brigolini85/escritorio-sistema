'use server';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { mensagemDoBanco } from '@/lib/mensagem-banco';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

const FALHA = 'Não foi possível salvar agora. Tente de novo.';

/** APROVAR / DESCARTAR a sugestão do agente (D19). Quem pode, o banco decide (pessoa do setor da demanda ou administrador). */
export async function decidirSugestao(id: string, aprovar: boolean): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, erro: 'Sugestão não encontrada.' };
  try {
    await obterUsuario();
    const { error } = await (await supabaseServidor()).rpc('decidir_sugestao', { p_id: id, p_aprovar: aprovar === true });
    if (error) {
      if (error.code !== 'P0001') console.error('[demandas] falha ao decidir a sugestão', error);
      return { ok: false, erro: error.code === 'P0001' ? mensagemDoBanco(error.message) : FALHA };
    }
    revalidatePath('/demandas');
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e);   // sessão vencida: redirect para /entrar continua valendo
    console.error('[demandas] falha ao decidir a sugestão', e);
    return { ok: false, erro: FALHA };
  }
}
