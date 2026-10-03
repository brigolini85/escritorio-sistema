import { CircleDollarSign } from 'lucide-react';
import type { FuncionalidadeIa } from '@escritorio/core';
import { EmptyState } from '@/components/patterns/empty-state';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { formatarNumero, formatarUSD } from '@/lib/formatos';
import { INFO_FUNCIONALIDADE, percentual } from '@/lib/gastos';
import { IconeFuncionalidade } from './icone-funcionalidade';

export type LinhaFuncionalidade = { funcionalidade: string; custo_usd: number | string; chamadas: number | string };

/** Gasto por funcionalidade (spec 7B.3): tabela com ícone, nome, barra decorativa, custo, % e chamadas. */
export function PorFuncionalidade({ linhas }: { linhas: LinhaFuncionalidade[] }) {
  const itens = linhas.map((l) => ({
    funcionalidade: l.funcionalidade,
    // Valor desconhecido do banco (funcionalidade nova) vira "Não identificado" no visual, sem quebrar a tela.
    info: INFO_FUNCIONALIDADE[l.funcionalidade as FuncionalidadeIa] ?? INFO_FUNCIONALIDADE.nao_identificado,
    custo: Number(l.custo_usd) || 0,
    chamadas: Number(l.chamadas) || 0,
  }));
  const total = itens.reduce((s, i) => s + i.custo, 0);
  const maior = Math.max(0, ...itens.map((i) => i.custo));

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Por funcionalidade</h2>
        <span className="text-sm text-subtle">custo · % · chamadas</span>
      </div>
      {itens.length === 0 ? (
        <EmptyState icone={CircleDollarSign} titulo="Nenhum gasto com IA neste período." className="py-6" />
      ) : (
        <table className="w-full text-base">
          <caption className="sr-only">Gasto por funcionalidade</caption>
          <thead className="sr-only">
            <tr><th scope="col">Funcionalidade</th><th scope="col">Proporção</th><th scope="col">Custo</th><th scope="col">%</th><th scope="col">Chamadas</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {itens.map((i, n) => (
              <tr key={i.funcionalidade} data-testid={`gastos-funcionalidade-${i.funcionalidade}`}>
                <th scope="row" className="py-2 pr-3 text-left font-semibold text-foreground">
                  <span className="flex items-center gap-2">
                    <IconeFuncionalidade icone={i.info.icone} />
                    {i.info.rotulo}
                  </span>
                </th>
                <td className="w-1/4 py-2 pr-3">
                  <div aria-hidden className="h-3">
                    <div className={cn('h-full min-w-0.5 rounded-sm', i.info.cor)} style={{ width: `${maior > 0 ? (i.custo / maior) * 100 : 0}%` }} />
                  </div>
                </td>
                <td className={cn('tabular whitespace-nowrap py-2 pr-3 text-right', n === 0 ? 'font-extrabold' : 'text-foreground')}>{formatarUSD(i.custo)}</td>
                <td className="tabular py-2 pr-3 text-right text-muted">{percentual(i.custo, total)}%</td>
                <td className="tabular py-2 text-right text-muted">{formatarNumero(i.chamadas, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
