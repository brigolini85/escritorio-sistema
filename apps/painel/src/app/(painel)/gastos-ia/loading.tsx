import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Esqueleto de Gastos com IA no formato real: quatro cartões e as caixas por funcionalidade e por dia. */
export default function CarregandoGastosIa() {
  return (
    <div role="status" aria-label="Carregando Gastos com IA" className="flex flex-col gap-6">
      <PageHeader titulo={<span className="font-extrabold">Gastos com IA</span>} className="mb-0" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="gap-2 border-t-4 border-t-border p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-1/2" />
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="gap-3 p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-40 w-full" />
          </Card>
        ))}
      </div>
    </div>
  );
}
