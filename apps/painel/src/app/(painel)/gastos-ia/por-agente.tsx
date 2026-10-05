import Link from 'next/link';
import { Bot } from 'lucide-react';
import { EmptyState } from '@/components/patterns/empty-state';
import { Card } from '@/components/ui/card';
import { formatarNumero, formatarUSD } from '@/lib/formatos';
import { percentual } from '@/lib/gastos';

export type LinhaPorAgente = { agente_id: string; slug: string; nome: string; custo_usd: number | string; chamadas: number | string };

/** Gastos por agente (spec 7E.8, D17). `null`: banco sem a Parte I — o bloco não aparece. */
export function PorAgente({ linhas }: { linhas: LinhaPorAgente[] | null }) {
  if (linhas === null) return null;
  const itens = linhas.map((l) => ({ ...l, custo: Number(l.custo_usd) || 0, n: Number(l.chamadas) || 0 }));
  const total = itens.reduce((s, i) => s + i.custo, 0);
  const maior = Math.max(0, ...itens.map((i) => i.custo));
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Por agente</h2>
        <span className="text-sm text-subtle">custo · % · chamadas</span>
      </div>
      {itens.length === 0 ? <EmptyState icone={Bot} titulo="Nenhum gasto de agente neste período." className="py-6" /> : (
        <table className="w-full text-base">
          <caption className="sr-only">Gasto por agente</caption>
          <thead className="sr-only"><tr><th scope="col">Agente</th><th scope="col">Proporção</th><th scope="col">Custo</th><th scope="col">%</th><th scope="col">Chamadas</th></tr></thead>
          <tbody className="divide-y divide-border">
            {itens.map((i) => (
              <tr key={i.agente_id} data-testid={`gastos-agente-${i.slug}`}>
                <th scope="row" className="py-2 pr-3 text-left font-semibold"><Link href={`/agentes/${i.slug}/atividade`} className="text-foreground hover:text-brand">{i.nome}</Link></th>
                <td className="w-1/4 py-2 pr-3"><div aria-hidden className="h-3"><div className="h-full min-w-0.5 rounded-sm bg-gasto-agente" style={{ width: `${maior > 0 ? (i.custo / maior) * 100 : 0}%` }} /></div></td>
                <td className="tabular whitespace-nowrap py-2 pr-3 text-right">{formatarUSD(i.custo)}</td>
                <td className="tabular py-2 pr-3 text-right text-muted">{percentual(i.custo, total)}%</td>
                <td className="tabular py-2 text-right text-muted">{formatarNumero(i.n, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
