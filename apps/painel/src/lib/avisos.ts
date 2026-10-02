/** Parâmetro com que as server actions devolvem um aviso de sucesso para a tela (`redirect(...?aviso=código)`). */
export const PARAM_AVISO = 'aviso';

// Só códigos conhecidos viram texto: a URL não deixa ninguém pôr frase própria na tela do escritório.
const AVISOS = {
  'contato-voltou': 'Contato arquivado voltou.',
  'contato-voltou-vinculos-sairam': 'Contato arquivado voltou. Os vínculos antigos com outras empresas saíram.',
  'contato-voltou-sem-empresas': 'Contato arquivado voltou, sem empresas. Os vínculos antigos saíram.',
  'contato-voltou-com-empresas': 'Contato arquivado voltou com as empresas escolhidas.',
  'contato-voltou-com-empresas-outras-sairam': 'Contato arquivado voltou com as empresas escolhidas. As outras saíram.',
} as const;

export type CodigoAviso = keyof typeof AVISOS;

export function textoDoAviso(codigo: string): string | null {
  return Object.hasOwn(AVISOS, codigo) ? AVISOS[codigo as CodigoAviso] : null;
}

/** Destino da ação com o aviso no fim (mantém os parâmetros que já estavam). */
export function comAvisoNaUrl(destino: string, aviso: CodigoAviso): string {
  return `${destino}${destino.includes('?') ? '&' : '?'}${PARAM_AVISO}=${aviso}`;
}

/** O mesmo endereço sem o `?aviso=` (os outros parâmetros ficam, na mesma ordem). */
export function enderecoSemAviso(caminho: string, busca: string): string {
  const resto = new URLSearchParams(busca);
  resto.delete(PARAM_AVISO);
  const q = resto.toString();
  return q ? `${caminho}?${q}` : caminho;
}
