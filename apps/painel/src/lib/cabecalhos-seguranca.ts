/**
 * Cabeçalhos de segurança do painel (segurança do login, item 6).
 * - CSP com nonce por pedido (o middleware gera; o Next põe o mesmo nonce nos próprios scripts). Sem 'unsafe-inline'
 *   em scripts. Estilos: 'unsafe-inline' de propósito — o Next e o Radix usam style="" (posição de menus, barras de
 *   progresso); script injetado continua barrado.
 * - Supabase: REST/Storage (https) e tempo real (wss) só no endereço configurado.
 * - A fonte (Plus Jakarta) é servida pelo próprio painel (next/font), então não há Google Fonts na política.
 */
type Ambiente = Record<string, string | undefined>;

export function gerarNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

/** Endereço do tempo real: https → wss, http → ws (mesmo host e porta). */
function enderecoTempoReal(supabaseUrl: string): string {
  const u = new URL(supabaseUrl);
  return `${u.protocol === 'https:' ? 'wss:' : 'ws:'}//${u.host}`;
}

export function politicaDeConteudo(p: { nonce: string; supabaseUrl: string; desenvolvimento: boolean }): string {
  const supabase = new URL(p.supabaseUrl).origin;
  const scripts = ["'self'", `'nonce-${p.nonce}'`, "'strict-dynamic'", ...(p.desenvolvimento ? ["'unsafe-eval'"] : [])];
  // Em desenvolvimento a recarga automática do Next usa websocket no próprio servidor.
  const conexoes = ["'self'", supabase, enderecoTempoReal(p.supabaseUrl), ...(p.desenvolvimento ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : [])];
  return [
    "default-src 'self'",
    `script-src ${scripts.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabase}`,
    `media-src 'self' blob: ${supabase}`,
    "font-src 'self'",
    `connect-src ${conexoes.join(' ')}`,
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** Valem para todas as respostas (next.config headers()), inclusive arquivos estáticos. */
export const CABECALHOS_FIXOS: { key: string; value: string }[] = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
];

/** HSTS só em produção servida por https (no computador local, http, o navegador guardaria a regra para localhost). */
export function cabecalhoHsts(env: Ambiente): string | null {
  return env.NODE_ENV === 'production' && (env.PAINEL_URL ?? '').trim().startsWith('https://') ? 'max-age=31536000; includeSubDomains' : null;
}
