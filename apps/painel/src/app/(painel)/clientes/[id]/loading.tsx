import { Skeleton } from '@/components/ui/skeleton';

/** Abrindo a ficha: trilha, título, abas, o índice e os primeiros blocos. */
export default function CarregandoFicha() {
  return (
    <div role="status" aria-label="Carregando a empresa" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-7 w-72" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="flex gap-2 border-b border-border pb-2">
        {['w-16', 'w-20', 'w-36', 'w-20', 'w-28', 'w-24'].map((w, i) => <Skeleton key={i} className={`h-6 ${w}`} />)}
      </div>
      <div className="flex items-start gap-5">
        <div className="hidden w-indice-ficha shrink-0 flex-col gap-2 rounded-lg border border-border bg-surface p-3 lg:flex">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <Skeleton key={i} className="h-5 w-full" />)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {[0, 1].map((b) => (
            <div key={b} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
              <Skeleton className="h-4 w-40" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className="flex flex-col gap-1.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-full" /></div>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
