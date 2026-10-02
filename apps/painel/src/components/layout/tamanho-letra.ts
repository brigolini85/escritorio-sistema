// Tamanho da letra da pessoa (spec 4.2). Fica no perfil (usuarios.tamanho_letra) e num cookie, para o <html>
// já nascer com a classe certa no servidor, como o tema.

export const COOKIE_LETRA = 'tamanho_letra';

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
  return `${COOKIE_LETRA}=${t}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
