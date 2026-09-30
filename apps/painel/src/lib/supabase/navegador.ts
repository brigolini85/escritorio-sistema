'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@escritorio/db';

export function supabaseNavegador() {
  return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!);
}

/**
 * Entrega a sessão da pessoa ao tempo real antes de assinar um canal. Sem isso o canal pode entrar como
 * anônimo (a sessão ainda não foi lida do cookie) e o RLS não entrega nenhum evento.
 */
export async function autenticarTempoReal(sb: ReturnType<typeof supabaseNavegador>): Promise<void> {
  const { data } = await sb.auth.getSession();
  if (data.session) await sb.realtime.setAuth(data.session.access_token);
}
