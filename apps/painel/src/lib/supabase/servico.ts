import 'server-only';
import { criarClienteServico } from '@escritorio/db';
import { supabaseUrl } from '@/lib/ambiente-publico';
import { chaveServico } from '@/lib/ambiente-servidor';

/** Ignora RLS: use só em ações de servidor que já verificaram a permissão do usuário. */
export function supabaseServico() {
  return criarClienteServico(supabaseUrl(), chaveServico());
}
