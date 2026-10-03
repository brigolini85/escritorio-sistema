import Link from 'next/link';
import { Users } from 'lucide-react';
import type { FuncionalidadeIa } from '@escritorio/core';
import { EmptyState } from '@/components/patterns/empty-state';
import { cn } from '@/lib/cn';
import { formatarNumero, formatarUSD, NBSP } from '@/lib/formatos';
import { INFO_FUNCIONALIDADE, ORDEM_EMPILHADO, iniciais, montarRanking, type LinhaPessoa } from '@/lib/gastos';
import { hrefComParams, type ParamsBusca } from '@/lib/tabela-url';

export type LinhaPessoaBanco = { usuario_id: string; nome: string; funcionalidade: string; custo_usd: number | string; chamadas: number | string };

// Funcionalidade nova que o painel ainda não conhece: cor e nome de "Não identificado", sem quebrar a tela.
const info = (f: string) => INFO_FUNCIONALIDADE[f as FuncionalidadeIa] ?? INFO_FUNCIONALIDADE.nao_identificado;
const usd = (v: number) => formatarUSD(v).replace(NBSP, ' ');

/** Quem mais gasta na equipe (spec 7B.3, P16): só ações de pessoas; barra empilhada com legenda sempre visível. */
export function RankingEquipe({ linhas, params }: { linhas: LinhaPessoaBanco[]; params: ParamsBusca }) {
  const ranking = montarRanking(linhas.map((l): LinhaPessoa => ({ ...l, custo_usd: Number(l.custo_usd) || 0, chamadas: Number(l.chamadas) || 0 })));

  return (
    <section aria-labelledby="gastos-ranking-titulo" className="flex flex-col rounded-lg border border-border bg-surface p-4 text-foreground">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 id="gastos-ranking-titulo" className="text-sm font-bold uppercase tracking-wide text-brand">Quem mais gasta na equipe</h2>
        <span className="text-sm text-subtle">ações feitas por pessoas</span>
      </div>
      {ranking.length === 0 ? (
        <EmptyState icone={Users} titulo="Nenhuma ação de pessoas com IA neste período." className="py-6" />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-base">
              <thead>
                <tr className="border-b border-border text-left text-sm font-bold uppercase tracking-wide text-muted">
                  <th scope="col" className="w-8 py-2 pr-3">#</th>
                  <th scope="col" className="py-2 pr-3">Pessoa</th>
                  <th scope="col" className="w-2/5 py-2 pr-3">Onde gastou</th>
                  <th scope="col" className="py-2 pr-3 text-right">Chamadas</th>
                  <th scope="col" className="py-2 pr-3 text-right">Custo</th>
                  <th scope="col" className="py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ranking.map((p, n) => (
                  <tr key={p.usuarioId}>
                    <td className="tabular py-3 pr-3 text-muted">{n + 1}</td>
                    <td className="py-3 pr-3">
                      <Link href={`/gastos-ia${hrefComParams(params, { pessoa: p.usuarioId })}`} scroll={false} className="flex items-center gap-2 font-semibold text-foreground underline-offset-4 hover:text-brand hover:underline">
                        <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{iniciais(p.nome)}</span>
                        {p.nome}
                      </Link>
                    </td>
                    <td className="py-3 pr-3">
                      <div role="img" aria-label={p.partes.map((parte) => `${info(parte.funcionalidade).rotulo} ${usd(parte.custo)}`).join(', ')} className="flex h-3 gap-0.5">
                        {p.partes.map((parte) => (
                          <div
                            key={parte.funcionalidade}
                            title={`${info(parte.funcionalidade).rotulo}: ${usd(parte.custo)}`}
                            className={cn('h-full min-w-0.5 rounded-sm', info(parte.funcionalidade).cor)}
                            style={{ width: `${parte.pct}%` }}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="tabular py-3 pr-3 text-right text-muted">{formatarNumero(p.chamadas, 0)}</td>
                    <td className={cn('tabular whitespace-nowrap py-3 pr-3 text-right', n === 0 ? 'font-extrabold' : 'text-foreground')}>{formatarUSD(p.custo)}</td>
                    <td className="tabular py-3 text-right text-muted">{p.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul aria-label="Legenda das cores" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
            {ORDEM_EMPILHADO.map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <span aria-hidden className={cn('size-2.5 rounded-sm', INFO_FUNCIONALIDADE[f].cor)} />
                {INFO_FUNCIONALIDADE[f].rotulo}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
