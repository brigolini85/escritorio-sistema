import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@escritorio/db';
import { chavePublica, supabaseUrl } from '@/lib/ambiente-publico';

export async function supabaseServidor() {
  const loja = await cookies();
  return createServerClient<Database>(supabaseUrl(), chavePublica(), {
    cookies: {
      getAll: () => loja.getAll(),
      setAll: (lista) => {
        try {
          for (const { name, value, options } of lista) loja.set(name, value, options);
        } catch {
          // Chamado a partir de Server Component: o middleware renova a sessão.
        }
      },
    },
  });
}
