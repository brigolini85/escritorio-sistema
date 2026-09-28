import 'server-only';
import { criarClienteServico } from '@escritorio/db';

/** Ignora RLS: use só em ações de servidor que já verificaram a permissão do usuário. */
export function supabaseServico() {
  return criarClienteServico(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
