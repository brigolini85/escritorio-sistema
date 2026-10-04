import { Skeleton } from '@/components/ui/skeleton';

/** Primeira entrada em Treinar o agente: esqueleto das três colunas. */
export default function CarregandoTreinarAgente() {
  return (
    <div role="status" aria-label="Carregando Treinar o agente" className="-m-6 flex flex-col lg:altura-trabalho lg:flex-row">
      <div className="flex flex-col gap-3 border-border bg-surface p-4 max-lg:border-b lg:w-lista-treinar lg:shrink-0 lg:border-r">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-full" />
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <div className="flex flex-col gap-3 border-border bg-surface p-4 max-lg:border-t lg:w-simulador-treinar lg:shrink-0 lg:border-l">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}
