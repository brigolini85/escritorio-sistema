// Menu lateral recolhido fica lembrado no cookie (lido pelo layout no servidor, então a página já nasce certa).
export const COOKIE_MENU = 'menu_recolhido';

export function menuRecolhidoDoCookie(valor: string | undefined): boolean {
  return valor === '1';
}

export function cookieDoMenu(recolhido: boolean): string {
  return `${COOKIE_MENU}=${recolhido ? '1' : '0'}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
