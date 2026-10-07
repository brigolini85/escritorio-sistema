import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ehRotaPublica } from '@/lib/rotas-publicas';
import { situacaoDe } from '@/lib/situacao-acesso';

export async function middleware(req: NextRequest) {
  let resposta = NextResponse.next({ request: req });
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA!, {
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
  // Revisão geral (painel M9): chamada a /api/* sem sessão recebe 401 em JSON (como a própria rota responderia), não o HTML do login;
  // link aberto no navegador (download) segue indo para /entrar.
  if (!data.user && !publica && caminho.startsWith('/api/') && !(req.headers.get('accept') ?? '').includes('text/html')) return NextResponse.json({ erro: 'sessão expirada' }, { status: 401 });
  if (!data.user && !publica) return NextResponse.redirect(new URL('/entrar', req.url));
  if (data.user && !publica) {
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
