import 'server-only';

type Ambiente = Record<string, string | undefined>;

const LOCAIS = new Set(['localhost', '127.0.0.1']);

/**
 * Endereço público do painel (segurança do login, item 4): base dos links de convite e de nova senha.
 * Nunca vem do pedido (cabeçalho Origin/Host); vem do ambiente e é conferido: http(s), sem caminho nem usuário,
 * e https em produção (http só no próprio computador, como a homologação do dono). Devolve sem a barra final.
 */
export function lerPainelUrl(env: Ambiente = process.env): string {
  const bruto = (env.PAINEL_URL ?? '').trim();
  let url: URL;
  try {
    url = new URL(bruto);
  } catch {
    throw new Error(`PAINEL_URL inválido ou ausente ("${bruto}"): use o endereço do painel, por exemplo https://painel.seudominio.com.br`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('PAINEL_URL precisa começar com https:// (ou http:// no computador local).');
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error('PAINEL_URL deve ser só o endereço do painel, sem caminho, usuário ou parâmetros.');
  }
  if (env.NODE_ENV === 'production' && url.protocol === 'http:' && !LOCAIS.has(url.hostname)) {
    throw new Error('PAINEL_URL precisa ser https em produção.');
  }
  return url.origin;
}

/** PAINEL_URL do processo, já conferido (lança com mensagem clara se estiver errado). */
export function painelUrl(): string {
  return lerPainelUrl(process.env);
}
