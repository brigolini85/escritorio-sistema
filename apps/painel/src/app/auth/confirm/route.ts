import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServidor } from '@/lib/supabase/servidor';

/**
 * Segurança do login (item 2): só os dois links que o escritório manda (supabase/templates: convite e nova senha).
 * Cadastro aberto, troca de e-mail e link mágico não existem no painel; qualquer outro tipo é recusado sem ir ao Supabase.
 */
const TIPOS_ACEITOS = new Set(['invite', 'recovery'] as const);
type TipoDoLink = 'invite' | 'recovery';

function tipoDoLink(bruto: string | null): TipoDoLink | null {
  return bruto && TIPOS_ACEITOS.has(bruto as TipoDoLink) ? (bruto as TipoDoLink) : null;
}

/** Link do e-mail de convite/recuperação: valida o token e segue para definir a senha. */
export async function GET(req: NextRequest) {
  const token_hash = req.nextUrl.searchParams.get('token_hash');
  const type = tipoDoLink(req.nextUrl.searchParams.get('type'));
  if (token_hash && type) {
    const sb = await supabaseServidor();
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL('/definir-senha', req.url));
  }
  return NextResponse.redirect(new URL('/entrar?erro=link', req.url));
}
