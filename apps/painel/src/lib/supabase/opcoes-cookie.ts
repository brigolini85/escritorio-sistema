import { SESSAO_MAXIMA_MS } from '@/lib/sessao-limites';

/**
 * Auditoria 2.2: opções dos cookies sb-* do Supabase (o padrão do @supabase/ssr é sem Secure e por 400 dias).
 * SameSite=Lax sempre; Secure fora do computador local (os e2e rodam em http://localhost) e, na dúvida (sem AMBIENTE),
 * ligado. Duram no máximo as 12 h da sessão do painel. httpOnly não dá: o cliente do navegador lê a sessão.
 */
export function opcoesCookieSupabase(ambiente: string | undefined) {
  return { path: '/', sameSite: 'lax' as const, secure: (ambiente ?? '').trim() !== 'local', maxAge: SESSAO_MAXIMA_MS / 1000 };
}
