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

/**
 * Redirecionamento relativo: atrás do proxy (Easypanel), o req.url do servidor standalone é http(s)://0.0.0.0:3000,
 * e um endereço absoluto montado com ele manda a pessoa para um site que não existe.
 */
function irPara(caminho: string) {
  return new NextResponse(null, { status: 307, headers: { Location: caminho } });
}

/** Link do e-mail de convite/recuperação: valida o token e segue para definir a senha. */
export async function GET(req: NextRequest) {
  const token_hash = req.nextUrl.searchParams.get('token_hash');
  const type = tipoDoLink(req.nextUrl.searchParams.get('type'));
  if (token_hash && type) {
    const sb = await supabaseServidor();
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (!error) return irPara('/definir-senha');
    console.error('[auth/confirm] verifyOtp', type, error.message);
  }
  return irPara('/entrar?erro=link');
}
