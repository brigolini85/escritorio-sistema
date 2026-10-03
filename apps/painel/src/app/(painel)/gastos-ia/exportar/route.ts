import { NextResponse, type NextRequest } from 'next/server';
import { lerPeriodo, lerPessoaAberta } from '@/lib/gastos';
import { linhasCsvGastos, type LinhaChamada } from '@/lib/gastos-csv';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';

const RECUSA = 'Só o administrador exporta os gastos com IA.';
const texto = (corpo: string, status: number) => new NextResponse(corpo, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });

/** CSV linha a linha do período (P13), até 100.000 chamadas. Só o administrador: a rota confere antes de ler, e o banco confere de novo. */
export async function GET(req: NextRequest) {
  // Sem sessão o middleware já mandou para /entrar; conta inativa ou fora do horário, obterUsuario redireciona.
  const u = await obterUsuario();
  if (u.papel !== 'admin') return texto(RECUSA, 403);
  const q = req.nextUrl.searchParams;
  const periodo = lerPeriodo({ p: q.get('p') ?? undefined, de: q.get('de') ?? undefined, ate: q.get('ate') ?? undefined }, new Date());
  // ?pessoa= inválido não vira "todo mundo": melhor recusar do que entregar o arquivo de outra pessoa.
  const pessoa = q.has('pessoa') ? lerPessoaAberta(q.get('pessoa') ?? undefined) : null;
  if (q.has('pessoa') && !pessoa) return texto('Pessoa inválida.', 400);
  const sb = await supabaseServidor();
  const [{ data, error }, { data: cfg }] = await Promise.all([
    sb.rpc('gastos_chamadas', { p_de: periodo.de, p_ate: periodo.ate, p_usuario: pessoa ?? undefined, p_limite: 100000 }),
    sb.from('configuracoes').select('cotacao_usd_brl').eq('id', 1).single(),
  ]);
  if (error) {
    if (error.message.includes('Só o administrador')) return texto(RECUSA, 403);
    console.error('[gastos-ia/exportar]', error.message);
    return texto('Não consegui exportar agora. Tente de novo.', 500);
  }
  const cotacao = cfg?.cotacao_usd_brl ? Number(cfg.cotacao_usd_brl) : null;
  const csv = linhasCsvGastos((data ?? []) as LinhaChamada[], cotacao);
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="gastos-ia-${periodo.deDia}-a-${periodo.ateDia}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
