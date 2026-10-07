/**
 * Segundo fator (segurança do login, item 8): aplicativo autenticador (TOTP) obrigatório para administrador e para quem
 * tem "Ver acessos de portais". O middleware manda quem precisa e está só com a senha (aal1) para /segundo-fator; o banco
 * recusa as ações sensíveis sem o fator (exigir_segundo_fator).
 */
export const TELA_SEGUNDO_FATOR = '/segundo-fator';

export function ehTelaDoSegundoFator(caminho: string): boolean {
  return caminho === TELA_SEGUNDO_FATOR || caminho === `${TELA_SEGUNDO_FATOR}/`;
}

/** Os 6 números do aplicativo (os espaços que alguns aplicativos mostram são tirados), ou null. */
export function codigoDoFormulario(bruto: unknown): string | null {
  const texto = typeof bruto === 'string' ? bruto.replace(/\s+/g, '') : '';
  return /^\d{6}$/.test(texto) ? texto : null;
}

/** Para onde vai depois do código: lista fixa (nunca um endereço vindo da URL). */
export function destinoDepoisDoFator(depois: unknown): string {
  return depois === 'senha' ? '/definir-senha' : '/inicio';
}
