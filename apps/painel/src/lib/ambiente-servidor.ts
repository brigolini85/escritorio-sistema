import 'server-only';
import { lerPainelUrl } from './ambiente-validar';

export { lerPainelUrl } from './ambiente-validar';

/** PAINEL_URL do processo, já conferido (lança com mensagem clara se estiver errado). Segurança do login, item 4. */
export function painelUrl(): string {
  return lerPainelUrl(process.env);
}

/** Chave de serviço: só no servidor (este módulo é server-only). Vazia: erro com o nome. */
export function chaveServico(): string {
  const v = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!v) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada.');
  return v;
}
