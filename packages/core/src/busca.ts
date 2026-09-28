/** Palavras que aparecem nos pedidos mas não identificam ninguém. */
const IGNORADAS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'pro', 'pra', 'para', 'por',
  'nf', 'nota', 'notas', 'fiscal', 'tira', 'tirar', 'emite', 'emitir', 'favor', 'unidade', 'loja', 'filial', 'me', 'manda',
]);

function normalizar(texto: string): string[] {
  return texto
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(Boolean);
}

/** Palavras do texto que servem para buscar (sem acento, sem pontuação, sem palavras de pedido, sem repetição). */
export function palavrasDeBusca(texto: string): string[] {
  return [...new Set(normalizar(texto).filter((p) => !IGNORADAS.has(p)))];
}

/**
 * Pontua cada candidato pelo número de palavras do texto iguais a alguma palavra dos seus termos
 * e devolve os de maior pontuação (empate = todos), na ordem original, até o limite.
 */
export function melhoresCandidatos<T>(texto: string, candidatos: { item: T; termos: string[] }[], limite = 5): T[] {
  const busca = palavrasDeBusca(texto);
  if (busca.length === 0) return [];
  const pontuados = candidatos.map((c) => {
    const palavras = new Set(c.termos.flatMap(normalizar));
    return { item: c.item, pontos: busca.filter((p) => palavras.has(p)).length };
  });
  const maximo = Math.max(0, ...pontuados.map((p) => p.pontos));
  if (maximo === 0) return [];
  return pontuados.filter((p) => p.pontos === maximo).slice(0, limite).map((p) => p.item);
}
