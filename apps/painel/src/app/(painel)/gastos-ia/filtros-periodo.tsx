import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/cn';
import type { FiltroPeriodo, Periodo } from '@/lib/gastos';

const FILTROS: { filtro: FiltroPeriodo; rotulo: string }[] = [
  { filtro: 'hoje', rotulo: 'Hoje' },
  { filtro: '7d', rotulo: '7 dias' },
  { filtro: 'mes', rotulo: 'Este mês' },
  { filtro: 'mes-passado', rotulo: 'Mês passado' },
];

const botao = 'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border px-3 text-sm font-bold transition-colors duration-150 ease-out';
const ligado = 'border-grafite bg-grafite text-grafite-foreground';
const desligado = 'border-border bg-surface text-foreground hover:bg-surface-muted';

/** Filtros de período (spec 7B.3): links simples (a tela recarrega no servidor) e o período livre num formulário GET. */
export function FiltrosPeriodo({ periodo }: { periodo: Periodo }) {
  const livre = periodo.filtro === 'periodo';
  return (
    <nav aria-label="Período" className="flex flex-wrap items-center gap-2">
      {FILTROS.map((f) => {
        const atual = periodo.filtro === f.filtro;
        return (
          <Link key={f.filtro} href={`/gastos-ia?p=${f.filtro}`} aria-current={atual ? 'page' : undefined} className={cn(botao, atual ? ligado : desligado)}>
            {f.rotulo}
          </Link>
        );
      })}
      <details className="relative">
        <summary className={cn(botao, 'list-none [&::-webkit-details-marker]:hidden', livre ? ligado : desligado)} aria-current={livre ? 'true' : undefined}>
          <CalendarDays aria-hidden size={14} strokeWidth={1.75} /> Período
        </summary>
        <form method="get" action="/gastos-ia" className="absolute right-0 top-full z-20 mt-2 flex w-max flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-md">
          <input type="hidden" name="p" value="periodo" />
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="gastos-de">De</Label>
              <Input id="gastos-de" type="date" name="de" defaultValue={livre ? periodo.deDia : undefined} required />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="gastos-ate">Até</Label>
              <Input id="gastos-ate" type="date" name="ate" defaultValue={livre ? periodo.ateDia : undefined} required />
            </div>
          </div>
          <button type="submit" className={cn(botao, ligado, 'justify-center uppercase')}>Ver</button>
        </form>
      </details>
      {/* Task 10: o link Exportar (CSV do período) entra aqui, ao lado do Período. */}
    </nav>
  );
}
