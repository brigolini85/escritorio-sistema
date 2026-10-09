import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { chavePublica, supabaseUrl } from './ambiente-publico';

/**
 * Auditoria 2.6: confere a senha atual antes da troca, num cliente sem cookie (não mexe na sessão de quem está trocando).
 * O login de conferência é encerrado na hora (scope local: só ele, as outras sessões da pessoa seguem).
 */
export async function senhaAtualConfere(email: string, senha: string): Promise<boolean> {
  if (!email || !senha) return false;
  const sb = createClient(supabaseUrl(), chavePublica(), { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error || !data.session) return false;
  const { error: erroSaida } = await sb.auth.signOut({ scope: 'local' });
  if (erroSaida) console.error('[definir-senha] sessão de conferência não encerrada', erroSaida.message);
  return true;
}
