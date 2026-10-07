/**
 * Limites da sessão (segurança do login, item 7): no máximo 12 h desde o login e 1 h sem uso.
 * O Supabase faz o mesmo (config.toml [auth.sessions]), mas na nuvem só no plano Pro; o painel confere sempre.
 *
 * - Login: o momento mais antigo do `amr` do token (Supabase grava quando a senha/link foi usado; renovar o token não muda).
 *   O token já foi conferido pelo getUser antes de ser lido aqui.
 * - Último uso: cookie httpOnly assinado (HMAC-SHA256) e preso ao session_id. Sem cookie válido, conta desde o login:
 *   apagar ou mexer no cookie nunca estica a sessão.
 * Funciona no middleware (Web Crypto, sem Node).
 */
export const SESSAO_MAXIMA_MS = 12 * 60 * 60 * 1000;
export const INATIVIDADE_MS = 60 * 60 * 1000;
export const COOKIE_ATIVIDADE = 'painel_atividade';
/** Tolerância para relógios levemente diferentes entre servidores. */
const FOLGA_MS = 60 * 1000;

export type Claims = { session_id?: string; aal?: string; amr?: { method?: string; timestamp?: number }[] };

export function lerClaims(accessToken: string): Claims | null {
  try {
    const corpo = accessToken.split('.')[1];
    if (!corpo) return null;
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(corpo.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));
    return json && typeof json === 'object' ? (json as Claims) : null;
  } catch {
    return null;
  }
}

/** Momento do login em ms, ou null se o token não diz. */
export function momentoDoLogin(c: Claims): number | null {
  const tempos = (Array.isArray(c.amr) ? c.amr : []).map((a) => a?.timestamp).filter((t): t is number => typeof t === 'number' && Number.isFinite(t));
  return tempos.length ? Math.min(...tempos) * 1000 : null;
}

const codificar = new TextEncoder();

async function hmac(texto: string, segredo: string): Promise<string> {
  const chave = await crypto.subtle.importKey('raw', codificar.encode(`painel-atividade:${segredo}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const assinatura = new Uint8Array(await crypto.subtle.sign('HMAC', chave, codificar.encode(texto)));
  return btoa(String.fromCharCode(...assinatura)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function assinarAtividade(sessionId: string, quando: number, segredo: string): Promise<string> {
  return `${quando}.${await hmac(`${sessionId}.${quando}`, segredo)}`;
}

/** Momento do último uso, se o cookie é desta sessão e não foi mexido; senão null. */
export async function lerAtividade(valor: string | undefined, sessionId: string, segredo: string): Promise<number | null> {
  const m = /^(\d{1,15})\.([A-Za-z0-9_-]+)$/.exec(valor ?? '');
  if (!m) return null;
  const esperado = await hmac(`${sessionId}.${m[1]}`, segredo);
  if (esperado.length !== m[2]!.length) return null;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++) diferenca |= esperado.charCodeAt(i) ^ m[2]!.charCodeAt(i);
  return diferenca === 0 ? Number(m[1]) : null;
}

export function avaliarSessao(p: { login: number | null; atividade: number | null; agora: number }): 'ok' | 'vencida' {
  if (p.login !== null && p.agora - p.login > SESSAO_MAXIMA_MS) return 'vencida';
  const atividadeValida = p.atividade !== null && p.atividade <= p.agora + FOLGA_MS ? p.atividade : null;
  const ultimoUso = atividadeValida ?? p.login;
  if (ultimoUso !== null && p.agora - ultimoUso > INATIVIDADE_MS) return 'vencida';
  return 'ok';
}

/**
 * Só uso de verdade renova a 1 h (verificação final da entrada em produção). Uma tela de Atendimento aberta recarrega
 * pelo tempo real e a cada minuto (router.refresh); se isso contasse, nunca venceria. O middleware não distingue essas
 * recargas de um clique no menu (o Next tira dele os cabeçalhos RSC), então:
 * - página aberta direto (Sec-Fetch-Mode: navigate, ou cliente sem esse cabeçalho) e ação de formulário (Next-Action)
 *   contam como uso agora;
 * - o resto (navegação por link, recargas, pré-cargas, /api) só leva a atividade até o último toque da pessoa
 *   (clique, tecla, rolagem), que a tela grava no cookie `painel_uso` já no relógio do servidor (MarcarUso).
 * Uma recarga automática carrega o mesmo `painel_uso` velho: não estica nada. Um `painel_uso` de outra sessão (mais
 * velho que o login) também não. O `painel_uso` é lido pelo JavaScript da tela; mexer nele à mão só adianta até a
 * hora atual e nunca passa das 12 h do login.
 */
export const COOKIE_USO = 'painel_uso';

export function momentoDoUso(p: { modo: string | null; acao: boolean; marca: string | undefined; agora: number }): number | null {
  if (p.acao || p.modo === null || p.modo === 'navigate') return p.agora;
  const m = /^\d{1,15}$/.exec(p.marca ?? '');
  if (!m) return null;
  const t = Number(m[0]);
  return t <= p.agora + FOLGA_MS ? Math.min(t, p.agora) : null;
}

/** Novo momento de atividade a gravar, ou null se o pedido não traz uso mais novo que o já contado (ou que o login). */
export function atividadeNova(p: { uso: number | null; atividade: number | null; login: number | null }): number | null {
  if (p.uso === null) return null;
  const base = p.atividade ?? p.login;
  return base === null || p.uso > base ? p.uso : null;
}
