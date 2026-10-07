import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { chavePublica, supabaseUrl } from '@/lib/ambiente-publico';
import { cabecalhoHsts, gerarNonce, politicaDeConteudo } from '@/lib/cabecalhos-seguranca';
import { ehRotaPublica } from '@/lib/rotas-publicas';
import { assinarAtividade, avaliarSessao, COOKIE_ATIVIDADE, lerAtividade, lerClaims, momentoDoLogin, SESSAO_MAXIMA_MS } from '@/lib/sessao-limites';
import { situacaoDe } from '@/lib/situacao-acesso';

/** Cabeçalhos de segurança da resposta (item 6); os fixos vêm do next.config. */
function comSeguranca<R extends NextResponse>(r: R, csp: string): R {
  r.headers.set('Content-Security-Policy', csp);
  const hsts = cabecalhoHsts(process.env);
  if (hsts) r.headers.set('Strict-Transport-Security', hsts);
  return r;
}

export async function middleware(req: NextRequest) {
  // Segurança do login (item 6): nonce novo por pedido; o Next lê a CSP do pedido e põe o nonce nos próprios scripts.
  const nonce = gerarNonce();
  const csp = politicaDeConteudo({ nonce, supabaseUrl: supabaseUrl(), desenvolvimento: process.env.NODE_ENV !== 'production' });
  req.headers.set('x-nonce', nonce);
  req.headers.set('content-security-policy', csp);
  const resultado = await decidir(req);
  return comSeguranca(resultado, csp);
}

async function decidir(req: NextRequest): Promise<NextResponse> {
  let resposta = NextResponse.next({ request: req });
  const sb = createServerClient(supabaseUrl(), chavePublica(), {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        for (const { name, value } of lista) req.cookies.set(name, value);
        resposta = NextResponse.next({ request: req });
        for (const { name, value, options } of lista) resposta.cookies.set(name, value, options);
      },
    },
  });
  // Redirecionar levando os cookies que o getUser possa ter renovado.
  const redirecionar = (caminho: string) => {
    const r = NextResponse.redirect(new URL(caminho, req.url));
    for (const c of resposta.cookies.getAll()) r.cookies.set(c);
    return r;
  };
  const { data } = await sb.auth.getUser();
  const caminho = req.nextUrl.pathname;
  const publica = ehRotaPublica(caminho);
  const chamadaDeCodigo = caminho.startsWith('/api/') && !(req.headers.get('accept') ?? '').includes('text/html');
  // Revisão geral (painel M9): chamada a /api/* sem sessão recebe 401 em JSON (como a própria rota responderia), não o HTML do login;
  // link aberto no navegador (download) segue indo para /entrar.
  if (!data.user && !publica && chamadaDeCodigo) return NextResponse.json({ erro: 'sessão expirada' }, { status: 401 });
  if (!data.user && !publica) return NextResponse.redirect(new URL('/entrar', req.url));
  if (data.user && !publica) {
    // Segurança do login (item 7): no máximo 12 h desde o login e 1 h sem uso. O token já foi conferido pelo getUser.
    const { data: sessao } = await sb.auth.getSession();
    const claims = sessao.session ? lerClaims(sessao.session.access_token) : null;
    const sessionId = claims?.session_id ?? '';
    const segredo = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    const agora = Date.now();
    const atividade = sessionId ? await lerAtividade(req.cookies.get(COOKIE_ATIVIDADE)?.value, sessionId, segredo) : null;
    if (avaliarSessao({ login: claims ? momentoDoLogin(claims) : null, atividade, agora }) === 'vencida') {
      // Só esta sessão (as de outros computadores seguem as próprias contas); os cookies saem junto.
      await sb.auth.signOut({ scope: 'local' });
      resposta.cookies.delete(COOKIE_ATIVIDADE);
      if (chamadaDeCodigo) {
        const r = NextResponse.json({ erro: 'sessão expirada' }, { status: 401 });
        for (const c of resposta.cookies.getAll()) r.cookies.set(c);
        return r;
      }
      return redirecionar('/entrar?erro=sessao');
    }
    if (sessionId) {
      resposta.cookies.set(COOKIE_ATIVIDADE, await assinarAtividade(sessionId, agora, segredo), {
        httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSAO_MAXIMA_MS / 1000,
      });
    }
    // Horário de acesso (spec 7.2): o banco já recusa; aqui a pessoa vê o porquê. Erro na consulta não tranca ninguém.
    const { data: s, error } = await sb.rpc('situacao_acesso');
    if (error) console.error('[middleware] situação de acesso', error.message);
    const situacao = error ? null : situacaoDe(s);
    const naPagina = caminho.startsWith('/fora-do-horario');
    if (situacao === 'fora_do_horario' && !naPagina) return redirecionar('/fora-do-horario');
    if (situacao === 'liberado' && naPagina) return redirecionar('/inicio');
  }
  return resposta;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
