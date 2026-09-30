/** Parâmetro com que as server actions devolvem a falha para a página (`redirect(...?erro=...)`). */
export const PARAM_ERRO = 'erro';

/** O mesmo endereço sem o `?erro=` (os outros parâmetros ficam, na mesma ordem). */
export function enderecoSemErro(caminho: string, busca: string): string {
  const resto = new URLSearchParams(busca);
  resto.delete(PARAM_ERRO);
  const q = resto.toString();
  return q ? `${caminho}?${q}` : caminho;
}
