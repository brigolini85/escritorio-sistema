/** Linhas por ida ao PostgREST (o max_rows do Supabase é 1000: pedir mais devolve só 1000, sem erro). */
export const LINHAS_POR_PAGINA = 1000;

/**
 * Lê todas as linhas de uma consulta, de página em página (`pagina(de, ate)` faz o `.range(de, ate)` com uma ordem
 * estável, ex.: nome e id). Para na primeira página incompleta ou em `maxPaginas` (`parcial: true`).
 * Erro em qualquer página: devolve o erro e as linhas lidas até ali.
 */
export async function lerEmPaginas<T, E>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: E | null }>,
  { porPagina = LINHAS_POR_PAGINA, maxPaginas = 50 }: { porPagina?: number; maxPaginas?: number } = {},
): Promise<{ data: T[]; error: E | null; parcial: boolean }> {
  const linhas: T[] = [];
  for (let i = 0; i < maxPaginas; i++) {
    const de = i * porPagina;
    const { data, error } = await pagina(de, de + porPagina - 1);
    if (error) return { data: linhas, error, parcial: false };
    linhas.push(...(data ?? []));
    if ((data?.length ?? 0) < porPagina) return { data: linhas, error: null, parcial: false };
  }
  return { data: linhas, error: null, parcial: true };
}
