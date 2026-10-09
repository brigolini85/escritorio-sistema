import type { BrowserContext } from '@playwright/test';
import { assinarAtividade, COOKIE_ATIVIDADE, lerClaims } from '../src/lib/sessao-limites';

/** Sessão do Supabase guardada pelo @supabase/ssr no cookie sb-…-auth-token (pode vir em pedaços .0, .1…). */
export async function sessaoDoNavegador(ctx: BrowserContext): Promise<{ access_token: string }> {
  const cookies = (await ctx.cookies()).filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name));
  cookies.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
  const bruto = cookies.map((c) => c.value).join('');
  const json = bruto.startsWith('base64-') ? Buffer.from(bruto.slice(7), 'base64url').toString('utf8') : decodeURIComponent(bruto);
  return JSON.parse(json) as { access_token: string };
}

/** Finge que a última atividade foi há `ms`: grava o cookie assinado como o painel faria. */
export async function atividadeHa(ctx: BrowserContext, baseURL: string, ms: number): Promise<void> {
  const { access_token } = await sessaoDoNavegador(ctx);
  const sessionId = lerClaims(access_token)!.session_id!;
  // Auditoria 2.7: o mesmo segredo próprio que o playwright.config passa ao painel dos testes.
  const valor = await assinarAtividade(sessionId, Date.now() - ms, process.env.PAINEL_SEGREDO_SESSAO!);
  await ctx.addCookies([{ name: COOKIE_ATIVIDADE, value: valor, url: baseURL, httpOnly: true, sameSite: 'Lax' }]);
}

/** Tira do banco local as pessoas criadas por um spec (login e linha em usuarios), para não aparecerem nas listas de outros. */
export async function apagarPessoas(emails: string[]): Promise<void> {
  const { db } = await import('./apoio');
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  for (const u of data.users.filter((x) => emails.includes(x.email ?? ''))) await db.auth.admin.deleteUser(u.id);
  await db.from('usuarios').delete().in('email', emails);
}
