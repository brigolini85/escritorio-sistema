/**
 * Recarga periódica de páginas que mostram sinais de vida e números (Início, Configurações): sem ela, o
 * `ultimoSinal` fica o do carregamento e o HealthSignal passa a "Atrasado"/"Parado" com o trabalhador batendo.
 * A página recarrega a cada `RECARGA_PERIODICA_MS` com a aba visível e, ao voltar para a aba, se a última recarga
 * tem mais de `RECARGA_AO_VOLTAR_MS` (troca rápida de aba não recarrega).
 * O intervalo fica bem abaixo do "atrasado" dos batimentos (180 s) e casa com a memória de 60 s do gasto de IA.
 */
export const RECARGA_PERIODICA_MS = 60_000;
export const RECARGA_AO_VOLTAR_MS = 15_000;
/** De quanto em quanto tempo o relógio confere se já passou o intervalo. */
export const TIQUE_RECARGA_MS = 15_000;

export function deveRecarregar(p: { visivel: boolean; desdeUltimaMs: number; minimoMs: number }): boolean {
  return p.visivel && p.desdeUltimaMs >= p.minimoMs;
}
