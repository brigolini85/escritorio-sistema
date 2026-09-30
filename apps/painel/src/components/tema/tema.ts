// Tema do painel. A escolha fica no cookie "tema" (claro | escuro); sem cookie, segue o sistema.
// O layout raiz lê o cookie no servidor e põe data-theme no <html>, então a página já nasce no tema certo.

export const COOKIE_TEMA = 'tema';

export type EscolhaTema = 'claro' | 'escuro' | 'sistema';
export type DataTheme = 'light' | 'dark';

/** Valor de data-theme para o <html> a partir do cookie; undefined = segue o sistema. */
export function dataThemeDoCookie(valor: string | undefined | null): DataTheme | undefined {
  if (valor === 'claro') return 'light';
  if (valor === 'escuro') return 'dark';
  return undefined;
}

/** O que a pessoa escolheu, a partir do cookie (qualquer valor desconhecido = sistema). */
export function escolhaDoCookie(valor: string | undefined | null): EscolhaTema {
  return valor === 'claro' || valor === 'escuro' ? valor : 'sistema';
}

/** Cabeçalho do cookie para gravar a escolha; "sistema" apaga o cookie. */
export function cookieDaEscolha(escolha: EscolhaTema): string {
  const base = `${COOKIE_TEMA}=`;
  if (escolha === 'sistema') return `${base}; Path=/; Max-Age=0; SameSite=Lax`;
  return `${base}${escolha}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
