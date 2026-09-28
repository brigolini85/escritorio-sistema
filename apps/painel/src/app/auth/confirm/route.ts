import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServidor } from '@/lib/supabase/servidor';

/** Link do e-mail de convite/recuperação: valida o token e segue para definir a senha. */
export async function GET(req: NextRequest) {
  const token_hash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type') as EmailOtpType | null;
  if (token_hash && type) {
    const sb = await supabaseServidor();
    const { error } = await sb.auth.verifyOtp({ token_hash, type });
    if (!error) return NextResponse.redirect(new URL('/definir-senha', req.url));
  }
  return NextResponse.redirect(new URL('/entrar?erro=link', req.url));
}
