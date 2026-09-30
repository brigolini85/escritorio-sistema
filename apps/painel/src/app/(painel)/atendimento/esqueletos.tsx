import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

/** Carregando a lista de conversas: título, busca, filtros e itens no formato real. */
export function EsqueletoLista({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Carregando conversas" className={cn('flex min-h-0 flex-col bg-surface', className)}>
      <div className="flex flex-col gap-3 border-b border-border p-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-full" />
        <div className="flex flex-wrap gap-1">
          {['w-28', 'w-16', 'w-24', 'w-20', 'w-14'].map((w) => <Skeleton key={w} className={cn('h-7 rounded-full', w)} />)}
        </div>
      </div>
      <div className="flex flex-col divide-y divide-border overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 px-3 py-3">
            <div className="flex justify-between gap-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-12" /></div>
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-5 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Carregando a conversa: cabeçalho, balões alternados, compositor e o painel da direita. */
export function EsqueletoConversa() {
  return (
    <div role="status" aria-label="Carregando conversa" className="flex min-w-0 flex-1 flex-col bg-background max-lg:altura-trabalho lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-3">
          <div className="flex justify-between gap-2">
            <div className="flex flex-col gap-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-3 w-56" /></div>
            <Skeleton className="h-6 w-24" />
          </div>
          <div className="flex gap-2"><Skeleton className="h-8 w-24" /><Skeleton className="h-8 w-28" /><Skeleton className="h-8 w-24" /></div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
          {['mr-auto w-3/5', 'ml-auto w-1/2', 'mr-auto w-2/5', 'ml-auto w-3/5', 'mr-auto w-1/3'].map((c, i) => (
            <Skeleton key={i} className={cn('h-16 rounded-lg', c)} />
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-border bg-surface p-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
      <div className="hidden flex-col gap-3 border-l border-border bg-surface p-3 2xl:flex 2xl:w-painel-conversa">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
