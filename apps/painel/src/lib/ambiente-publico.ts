/**
 * Variáveis públicas do Supabase (vão para o navegador). Lidas por nome literal para o Next as embutir no código do
 * navegador. Vazias: erro com o nome, nunca um cliente apontando para "undefined" (segurança do login, item 5).
 */
export function supabaseUrl(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error('NEXT_PUBLIC_SUPABASE_URL não configurada.');
  return v;
}

export function chavePublica(): string {
  const v = process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA;
  if (!v) throw new Error('NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA não configurada.');
  return v;
}
