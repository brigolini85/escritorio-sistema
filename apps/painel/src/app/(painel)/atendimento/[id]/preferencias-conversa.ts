// Painel lateral da conversa (Assistente e Detalhes) aberto ou recolhido: cookie lido pela página no servidor.
export const COOKIE_PAINEL_CONVERSA = 'painel_conversa';

/** Sem cookie o painel começa aberto. */
export function painelAbertoDoCookie(valor: string | undefined): boolean {
  return valor !== '0';
}

export function cookiePainelConversa(aberto: boolean): string {
  return `${COOKIE_PAINEL_CONVERSA}=${aberto ? '1' : '0'}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

/** Nome da coluna da direita conforme as abas que a pessoa tem: "Cliente e Agente" ou "Cliente, Assistente e Agente". */
export const rotuloDasAbas = (comAssistente: boolean) => (comAssistente ? 'Cliente, Assistente e Agente' : 'Cliente e Agente');
