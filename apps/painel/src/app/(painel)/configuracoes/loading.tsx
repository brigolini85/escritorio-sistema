import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';

/** Primeira entrada em Configurações: navegação interna e cards das seções. */
export default function CarregandoConfiguracoes() {
  return (
    <section>
      <PageHeader titulo="Configurações" />
      <div role="status" aria-label="Carregando as configurações" className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex gap-1 lg:w-48 lg:shrink-0 lg:flex-col">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-8 w-28 lg:w-full" />)}
        </div>
        <div className="flex min-w-0 max-w-3xl flex-1 flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
