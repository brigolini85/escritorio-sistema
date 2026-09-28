import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@escritorio/db';

export async function supabaseServidor() {
  const loja = await cookies();
  return createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!, {
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
