import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Esqueleto do Início: o carregamento não sabe o papel (D22), então serve às duas versões. */
export default function CarregandoInicio() {
  return (
    <div role="status" aria-label="Carregando o Início" className="flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="gap-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-9 w-16" />
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="gap-3 p-4 xl:col-span-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </Card>
        <Card className="gap-3 p-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
        </Card>
      </div>
    </div>
  );
}
