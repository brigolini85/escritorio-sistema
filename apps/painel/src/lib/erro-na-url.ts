/** Parâmetro com que as server actions devolvem a falha para a página (`redirect(...?erro=...)`). */
export const PARAM_ERRO = 'erro';

/** O mesmo endereço sem o `?erro=` (os outros parâmetros ficam, na mesma ordem). */
export function enderecoSemErro(caminho: string, busca: string): string {
  const resto = new URLSearchParams(busca);
  resto.delete(PARAM_ERRO);
  const q = resto.toString();
  return q ? `${caminho}?${q}` : caminho;
}

/**
 * Revisão final (T11): o `?erro=` nunca põe na tela uma frase vinda da URL (um link forjado mostraria qualquer texto no
 * painel do escritório). Só códigos: os fixos deste mapa ou os assinados pelo servidor (erro-na-url-servidor.ts). O resto
 * vira ERRO_GENERICO.
 */
export const ERRO_GENERICO = 'Não deu certo. Tente de novo.';

export const ERROS = {
  falha: ERRO_GENERICO,
  'sem-acesso-conversa': 'Sem acesso a esta conversa.',
  'setor-nao-encontrado': 'Setor não encontrado.',
} as const;

export type CodigoErro = keyof typeof ERROS;
