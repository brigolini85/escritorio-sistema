import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './tipos.gen';

export type Db = SupabaseClient<Database>;

/** Cliente com a chave de serviço (ignora RLS). Só no servidor. */
export function criarClienteServico(url: string, chave: string): Db {
  return createClient<Database>(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
