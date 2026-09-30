/**
 * Combina a casca (`useAoVivo`) com a página que já recarrega sozinha pelo tempo real (`AtualizarAoVivo`).
 * Os dois ouvem conversas e chamados; quando a página vai dar `router.refresh()`, o layout já traz as contagens
 * e o estado do agente novos, então a casca não relê pelo navegador (evita o trabalho em dobro a cada evento).
 * A recarga marca a hora para a casca ainda avisar "Nova conversa aguardando atendimento" quando os números
 * do servidor sobem por causa dela.
 */
let paginasAoVivo = 0;
let recargaTempoRealEm = 0;

/** Chame ao montar uma página que recarrega pelo tempo real; devolve a função de desmontar. */
export function registrarPaginaAoVivo(): () => void {
  paginasAoVivo += 1;
  return () => {
    paginasAoVivo -= 1;
  };
}

export function paginaRecarregaAoVivo(): boolean {
  return paginasAoVivo > 0;
}

export function marcarRecargaPorTempoReal(): void {
  recargaTempoRealEm = Date.now();
}

/** Tempo desde a última recarga pedida pelo tempo real (Infinity se nunca houve). */
export function msDesdeRecargaPorTempoReal(): number {
  return recargaTempoRealEm ? Date.now() - recargaTempoRealEm : Infinity;
}
