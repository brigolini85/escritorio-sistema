/**
 * Senha mínima do painel (segurança do login, item 3). O Supabase Auth recusa o mesmo (config.toml
 * minimum_password_length = 10; na nuvem, Authentication > Providers > Email), então quem chamar a API direto
 * também não grava senha curta.
 */
export const SENHA_MINIMA = 10;

export function senhaCurta(senha: string): boolean {
  return senha.length < SENHA_MINIMA;
}
