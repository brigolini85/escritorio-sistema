/**
 * Auditoria 2.7: segredo do cookie de atividade (HMAC em sessao-limites.ts). Era a SUPABASE_SERVICE_ROLE_KEY, a chave
 * mais poderosa, e com `?? ''` virava segredo vazio (forjável) se faltasse no middleware. Agora:
 * - PAINEL_SEGREDO_SESSAO, com pelo menos 32 caracteres (a partida confere em ambiente-validar.ts);
 * - faltando fora do computador local: devolve vazio e o middleware trata a sessão como vencida (falha fechada);
 * - no computador local (AMBIENTE=local) pode faltar: sorteia um por processo, com aviso, para o desenvolvimento e os
 *   testes seguirem. Trocar o segredo faz a 1 h sem uso contar desde o login.
 * Funciona no middleware (Web Crypto, sem Node).
 */
export const SEGREDO_SESSAO_MINIMO = 32;

type Ambiente = Record<string, string | undefined>;
const memoria = globalThis as typeof globalThis & { __painelSegredoSessaoLocal?: string };

function ambienteDe(env: Ambiente): string {
  return (env.AMBIENTE ?? env.NEXT_PUBLIC_AMBIENTE ?? '').trim();
}

export function segredoDaSessao(env: Ambiente): string {
  const valor = (env.PAINEL_SEGREDO_SESSAO ?? '').trim();
  if (valor.length >= SEGREDO_SESSAO_MINIMO) return valor;
  if (valor || ambienteDe(env) !== 'local') return '';
  if (!memoria.__painelSegredoSessaoLocal) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    memoria.__painelSegredoSessaoLocal = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    console.warn('[painel] PAINEL_SEGREDO_SESSAO ausente: usando um segredo sorteado só para este processo (vale só no computador local).');
  }
  return memoria.__painelSegredoSessaoLocal;
}
