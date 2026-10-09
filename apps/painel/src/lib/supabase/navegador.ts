'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@escritorio/db';
import { chavePublica, supabaseUrl } from '@/lib/ambiente-publico';
import { opcoesCookieSupabase } from './opcoes-cookie';

export function supabaseNavegador() {
  // Auditoria 2.2: o AMBIENTE não chega ao navegador; a página em https é o sinal de que não é o computador local.
  const local = typeof window !== 'undefined' && window.location.protocol !== 'https:';
  return createBrowserClient<Database>(supabaseUrl(), chavePublica(), { cookieOptions: opcoesCookieSupabase(local ? 'local' : undefined) });
}

/**
 * Entrega a sessão da pessoa ao tempo real antes de assinar um canal. Sem isso o canal pode entrar como
 * anônimo (a sessão ainda não foi lida do cookie) e o RLS não entrega nenhum evento.
 * Devolve false (e registra o erro) quando não há sessão: quem chama não assina o canal.
 */
export async function autenticarTempoReal(sb: ReturnType<typeof supabaseNavegador>): Promise<boolean> {
  try {
    const { data, error } = await sb.auth.getSession();
    if (error || !data.session) {
      console.error('[tempo real] sem sessão: canal não assinado', error ?? '');
      return false;
    }
    // Sem argumento, o realtime lê o token da sessão atual pelo callback do supabase-js (e continua renovando).
    await sb.realtime.setAuth();
    return true;
  } catch (e) {
    console.error('[tempo real] falha ao autenticar: canal não assinado', e);
    return false;
  }
}
