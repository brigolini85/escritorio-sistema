export type PrecoModelo = { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number };
export type UsoTokens = { entrada: number; saida: number; cacheLeitura: number; cacheEscrita: number };

/** Preços em US$ por milhão de tokens. */
export function calcularCustoUsd(uso: UsoTokens, preco: PrecoModelo): number {
  return (
    uso.entrada * preco.entrada +
    uso.saida * preco.saida +
    uso.cacheLeitura * preco.cacheLeitura +
    uso.cacheEscrita * preco.cacheEscrita
  ) / 1_000_000;
}
