'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@escritorio/db';

export function supabaseNavegador() {
  return createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!);
}
