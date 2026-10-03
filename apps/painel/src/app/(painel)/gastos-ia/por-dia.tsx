import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { formatarNumero, formatarUSD } from '@/lib/formatos';
import { textoDiaMaisCaro } from '@/lib/gastos';
import { TabelaRecolhivel } from './tabela-recolhivel';

export type LinhaDia = { dia: string; custo_usd: number | string; chamadas: number | string };
export type DiaMaisCaro = { dia: string; custo_dia: number | string; dias_com_gasto: number | string; funcionalidade: string; pessoa: string | null; chamadas: number | string };

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

/** Eixo: primeira data, a do meio e a última, mais "hoje" sob a barra de hoje (as datas perto dele saem para não encavalar). */
function rotulosDoEixo(dias: string[], hoje: string): Map<number, string> {
  const rotulos = new Map<number, string>();
  if (dias.length === 0) return rotulos;
  const iHoje = dias.indexOf(hoje);
  const perto = Math.max(2, Math.ceil(dias.length * 0.12));
  for (const n of new Set([0, Math.floor((dias.length - 1) / 2), dias.length - 1])) {
    if (iHoje < 0 || Math.abs(n - iHoje) >= perto) rotulos.set(n, ddmm(dias[n]!));
  }
  if (iHoje >= 0) rotulos.set(iHoje, 'hoje');
  return rotulos;
}

/** Gasto por dia (spec 7B.3): série única sem legenda, hoje em vinho e escrito "hoje"; a tabela é a leitura acessível. */
export function PorDia({ dias, hoje, diaMaisCaro }: { dias: LinhaDia[]; hoje: string; diaMaisCaro: DiaMaisCaro | null }) {
  const itens = dias.map((d) => ({ dia: d.dia, custo: Number(d.custo_usd) || 0, chamadas: Number(d.chamadas) || 0 }));
  const maior = Math.max(0, ...itens.map((i) => i.custo));
  const rotulos = rotulosDoEixo(itens.map((i) => i.dia), hoje);
  const alerta = diaMaisCaro
    ? textoDiaMaisCaro({ ...diaMaisCaro, custo_dia: Number(diaMaisCaro.custo_dia), dias_com_gasto: Number(diaMaisCaro.dias_com_gasto), chamadas: Number(diaMaisCaro.chamadas) })
    : null;

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand">Por dia</h2>
        <span className="text-sm text-subtle">hoje em vinho</span>
      </div>

      <div aria-hidden>
        <div className="flex h-40 items-end justify-center gap-0.5">
          {itens.map((i) => {
            const pct = maior > 0 ? (i.custo / maior) * 100 : 0;
            return (
              <div
                key={i.dia} data-testid={`gastos-dia-${i.dia}`}
                title={`${ddmm(i.dia)}: ${formatarUSD(i.custo)} · ${formatarNumero(i.chamadas, 0)} ${i.chamadas === 1 ? 'chamada' : 'chamadas'}`}
                className="flex h-full min-w-0 max-w-12 flex-1 items-end"
              >
                {i.custo > 0
                  ? <div className={cn('w-full rounded-t-sm', i.dia === hoje ? 'bg-gasto-hoje' : 'bg-gasto-dia')} style={{ height: `${pct}%` }} />
                  : <div className="h-px w-full bg-border" />}
              </div>
            );
          })}
        </div>
        <div className="mt-1 flex justify-center gap-0.5 text-xs text-subtle">
          {itens.map((i, n) => {
            const rotulo = rotulos.get(n);
            return (
              <div key={i.dia} className="relative h-4 min-w-0 max-w-12 flex-1">
                {rotulo && (
                  <span className={cn('absolute top-0 whitespace-nowrap', n === 0 ? 'left-0' : n === itens.length - 1 ? 'right-0' : 'left-1/2 -translate-x-1/2', rotulo === 'hoje' && 'font-semibold text-foreground')}>
                    {rotulo}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <TabelaRecolhivel rotulo="Tabela do gasto por dia">
        <table aria-label="Gasto por dia" className="w-full">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wide text-muted">
              <th scope="col" className="py-1 pr-3">Dia</th>
              <th scope="col" className="py-1 pr-3 text-right">Custo</th>
              <th scope="col" className="py-1 text-right">Chamadas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {itens.map((i) => (
              <tr key={i.dia}>
                <th scope="row" className="py-1 pr-3 text-left font-normal">{ddmm(i.dia)}{i.dia === hoje && ' (hoje)'}</th>
                <td className="tabular py-1 pr-3 text-right">{formatarUSD(i.custo)}</td>
                <td className="tabular py-1 text-right">{formatarNumero(i.chamadas, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabelaRecolhivel>

      {alerta && (
        <p data-testid="gastos-alerta-dia" role="note" className="mt-3 flex items-start gap-2 rounded-md bg-warning-soft px-3 py-2 text-sm text-foreground">
          <AlertTriangle aria-hidden size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-warning" />
          {alerta}
        </p>
      )}
    </Card>
  );
}
