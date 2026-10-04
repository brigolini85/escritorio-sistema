import { PageHeader } from '@/components/layout/page-header';
import { Skeleton } from '@/components/ui/skeleton';

/** Configurações: menu por seção e o cartão da seção aberta. */
export default function CarregandoConfiguracoes() {
  return (
    <section>
      <PageHeader titulo="Configurações" />
      <div role="status" aria-label="Carregando as configurações" className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 lg:w-64 lg:shrink-0">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4 rounded-lg border border-border bg-surface p-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-3/4" />
        </div>
      </div>
    </section>
  );
}
