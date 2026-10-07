import { COOKIE_USO, SESSAO_MAXIMA_MS } from './sessao-limites';

/** Um toque a cada 5 s basta: a regra é de 1 h. */
export const INTERVALO_MARCA_USO_MS = 5000;

/** Cookie com o último toque da pessoa, no relógio do servidor (desvio = hora do servidor − hora do navegador). */
export function cookieDeUso(p: { agoraNavegador: number; desvioMs: number; https: boolean }): string {
  const momento = Math.round(p.agoraNavegador + p.desvioMs);
  return `${COOKIE_USO}=${momento}; path=/; max-age=${SESSAO_MAXIMA_MS / 1000}; samesite=lax${p.https ? '; secure' : ''}`;
}
