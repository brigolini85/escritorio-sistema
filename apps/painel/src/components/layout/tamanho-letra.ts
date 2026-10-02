// Tamanho da letra da pessoa (spec 4.2). Fica no perfil (usuarios.tamanho_letra) e num cookie, para o <html>
// já nascer com a classe certa no servidor, como o tema.

export const COOKIE_LETRA = 'tamanho_letra';

/** Um ano, em segundos: vale para o cookie escrito no navegador e para o escrito no servidor. */
export const MAX_AGE_LETRA = 31536000;

/** Opções do cookie quando ele é gravado no servidor (cookies().set); iguais às de cookieDoTamanho. */
export const OPCOES_COOKIE_LETRA = { path: '/', maxAge: MAX_AGE_LETRA, sameSite: 'lax' } as const;

export type TamanhoLetra = 'normal' | 'grande' | 'maior';

export const OPCOES_LETRA: { valor: TamanhoLetra; rotulo: string }[] = [
  { valor: 'normal', rotulo: 'Normal' },
  { valor: 'grande', rotulo: 'Grande' },
  { valor: 'maior', rotulo: 'Maior' },
];

export function tamanhoDoValor(v: string | null | undefined): TamanhoLetra {
  return v === 'grande' || v === 'maior' ? v : 'normal';
}

export function classeDoTamanho(t: TamanhoLetra): string | undefined {
  return t === 'normal' ? undefined : `letra-${t}`;
}

export function cookieDoTamanho(t: TamanhoLetra): string {
  return `${COOKIE_LETRA}=${t}; Path=/; Max-Age=${MAX_AGE_LETRA}; SameSite=Lax`;
}

/** Valor do cookie do tamanho dentro de um document.cookie; undefined se não houver. */
export function lerCookieLetra(documentCookie: string): string | undefined {
  for (const parte of documentCookie.split(';')) {
    const [nome, ...resto] = parte.trim().split('=');
    if (nome === COOKIE_LETRA) return resto.join('=');
  }
  return undefined;
}

/** O cookie (ou a falta dele, que vale normal) difere do tamanho do perfil: a tela precisa se acertar com o perfil. */
export function precisaSincronizarLetra(cookie: string | undefined, perfil: TamanhoLetra): boolean {
  return tamanhoDoValor(cookie) !== perfil;
}
