import { Skeleton } from '@/components/ui/skeleton';

/** Abrindo a ficha: esqueleto com o formato dela (trilha, título, abas e o cartão de dados). */
export default function CarregandoFicha() {
  return (
    <div role="status" aria-label="Carregando a empresa" className="flex max-w-5xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex gap-2 border-b border-border pb-2">
        {['w-16', 'w-20', 'w-36', 'w-20', 'w-28', 'w-24'].map((w, i) => <Skeleton key={i} className={`h-6 ${w}`} />)}
      </div>
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="flex flex-col gap-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-4 w-48" /></div>)}
        </div>
      </div>
    </div>
  );
}
