import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { Card } from '@/components/ui/card';
import { acessoAosAgentes, lerAgente, semMigracaoI1, souDono } from '@/lib/agentes';
import { cn } from '@/lib/cn';
import { formatarUSD } from '@/lib/formatos';
import { lerPeriodo } from '@/lib/gastos';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { resumirAtividade, type LinhaAtividade } from './resumo';

const PERIODOS = [{ p: 'mes', rotulo: 'Este mês' }, { p: 'mes-passado', rotulo: 'Mês passado' }, { p: '7d', rotulo: '7 dias' }] as const;

/** Atividade e custo (spec 7E.3, D18): por dia, atendimentos, sozinho, passagens e custo — só dono e administrador. */
export default async function Atividade({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ParamsBusca> }) {
  const [{ slug }, busca, u] = await Promise.all([params, searchParams, obterUsuario()]);
  const sb = await supabaseServidor();
  const [{ agente, semMigracao }, dono] = await Promise.all([lerAgente(sb, slug), souDono(sb)]);
  if (!agente) notFound();
  if (!acessoAosAgentes(u, dono).numeros) return <EmptyState icone={BarChart3} titulo="Só o dono e o administrador veem os números." />;
  if (semMigracao) return null;
  const periodo = lerPeriodo({ p: valorParam(busca, 'p') }, new Date());
  const { data, error } = await sb.rpc('atividade_do_agente', { p_slug: slug, p_de: periodo.de, p_ate: periodo.ate });
  if (error && !semMigracaoI1(error)) console.error('[agentes] atividade', error);
  const linhas = (data ?? []) as LinhaAtividade[];
  const r = resumirAtividade(linhas);
  const cartao = (rotulo: string, valor: string) => (
    <Card className="flex flex-col gap-1 p-4"><span className="text-xs font-bold uppercase tracking-wide text-muted">{rotulo}</span><span className="tabular text-2xl font-extrabold">{valor}</span></Card>
  );
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Período" className="flex gap-2">
        {PERIODOS.map((x) => (
          <Link key={x.p} href={`/agentes/${slug}/atividade?p=${x.p}`} aria-current={periodo.filtro === x.p ? 'page' : undefined}
            className={cn('inline-flex h-9 items-center rounded-md border px-3 text-sm font-bold', periodo.filtro === x.p ? 'border-grafite bg-grafite text-grafite-foreground' : 'border-border bg-surface')}>{x.rotulo}</Link>
        ))}
      </nav>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cartao('Atendimentos', String(r.atendimentos))}
        {cartao('Resolvidos sozinho', r.sozinho === null ? '—' : `${r.sozinho}%`)}
        {cartao('Passaram para pessoa', String(r.passagens))}
        {cartao('Custo', formatarUSD(r.custoUsd + r.custoTestesUsd))}
      </div>
      <Card className="p-4">
        {linhas.length === 0 ? <EmptyState icone={BarChart3} titulo={`Nada neste período (${periodo.rotulo}).`} className="py-6" /> : (
          <table className="w-full text-sm">
            <caption className="sr-only">Atividade por dia</caption>
            <thead><tr className="text-left text-xs uppercase text-muted"><th className="py-2">Dia</th><th>Atendimentos</th><th>Sozinho</th><th>Passaram para pessoa</th><th className="text-right">Custo</th><th className="text-right">Testes</th></tr></thead>
            <tbody className="divide-y divide-border">
              {linhas.map((l) => (
                <tr key={l.dia}>
                  {/* dia vem como AAAA-MM-DD (Brasília): formatarData leria como UTC e voltaria um dia. */}
                  <td className="tabular py-2">{`${l.dia.slice(8, 10)}/${l.dia.slice(5, 7)}`}</td><td className="tabular">{Number(l.atendimentos)}</td><td className="tabular">{Number(l.resolvidos)}</td>
                  <td className="tabular">{Number(l.atendimentos) - Number(l.resolvidos)}</td>
                  <td className="tabular text-right">{formatarUSD(Number(l.custo_usd))}</td><td className="tabular text-right text-muted">{formatarUSD(Number(l.custo_testes_usd))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-sm text-muted">Custo diário conta só chamadas ligadas a uma conversa; o total do mês em Gastos com IA pode ser maior.</p>
      <p className="text-sm text-muted">Tarefas de trabalho: chegam numa próxima etapa.{u.papel === 'admin' && <> Todos os gastos em <Link href="/gastos-ia" className="font-bold text-brand">Gastos com IA</Link>.</>}</p>
    </div>
  );
}
