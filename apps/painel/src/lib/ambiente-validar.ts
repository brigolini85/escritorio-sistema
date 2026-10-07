/**
 * Conferência das variáveis do painel (segurança do login, itens 4 e 5). Só regras puras sobre o objeto recebido: serve à
 * partida do servidor (instrumentation.ts) e aos leitores. Nenhum valor secreto vai para as mensagens.
 */
export type Ambiente = Record<string, string | undefined>;

const LOCAIS = new Set(['localhost', '127.0.0.1']);

function urlHttp(nome: string, bruto: string | undefined, env: Ambiente, exemplo: string): URL {
  const texto = (bruto ?? '').trim();
  let url: URL;
  try {
    url = new URL(texto);
  } catch {
    throw new Error(`${nome} inválido ou ausente: use o endereço completo, por exemplo ${exemplo}`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error(`${nome} precisa começar com https:// (ou http:// no computador local).`);
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) {
    throw new Error(`${nome} deve ser só o endereço, sem caminho, usuário ou parâmetros.`);
  }
  if (env.NODE_ENV === 'production' && url.protocol === 'http:' && !LOCAIS.has(url.hostname)) {
    throw new Error(`${nome} precisa ser https em produção.`);
  }
  return url;
}

/**
 * Endereço público do painel: base dos links de convite e de nova senha. Nunca vem do pedido (Origin/Host).
 * http(s), sem caminho nem usuário, https em produção (http só no próprio computador). Devolve sem a barra final.
 */
export function lerPainelUrl(env: Ambiente): string {
  return urlHttp('PAINEL_URL', env.PAINEL_URL, env, 'https://painel.seudominio.com.br').origin;
}

/** Papel de uma chave JWT do Supabase (anon/service_role), ou null se não for JWT. */
function papelDaChave(chave: string): string | null {
  try {
    const corpo = chave.split('.')[1];
    if (!corpo) return null;
    const json = JSON.parse(atob(corpo.replace(/-/g, '+').replace(/_/g, '/'))) as { role?: unknown };
    return typeof json.role === 'string' ? json.role : null;
  } catch {
    return null;
  }
}

/** Lista do que está errado (vazia = pode subir). */
export function problemasDoAmbiente(env: Ambiente): string[] {
  const problemas: string[] = [];
  const tentar = (f: () => void) => {
    try {
      f();
    } catch (e) {
      problemas.push((e as Error).message);
    }
  };
  tentar(() => urlHttp('NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL, env, 'https://abcd.supabase.co'));
  tentar(() => {
    const chave = (env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA ?? '').trim();
    if (!chave) throw new Error('NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA ausente: use a chave pública (anon/publishable) do Supabase.');
    // Tudo o que começa com NEXT_PUBLIC_ vai para o navegador: a chave de serviço ali abriria o banco inteiro.
    if (chave.startsWith('sb_secret_') || papelDaChave(chave) === 'service_role') {
      throw new Error('NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA está com a chave de serviço: ela iria para o navegador. Use a chave pública.');
    }
  });
  tentar(() => {
    if (!(env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente: use a chave de serviço (secret) do Supabase, só no servidor.');
  });
  tentar(() => {
    if (env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY !== undefined) {
      throw new Error('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY não pode existir: a chave de serviço iria para o navegador. Apague a variável.');
    }
  });
  tentar(() => lerPainelUrl(env));
  return problemas;
}

/** Lança um erro só, com todos os problemas, para a partida do servidor parar com a mensagem clara. */
export function exigirAmbiente(env: Ambiente): void {
  const p = problemasDoAmbiente(env);
  if (p.length) throw new Error(`Painel sem configuração válida:\n- ${p.join('\n- ')}`);
}
