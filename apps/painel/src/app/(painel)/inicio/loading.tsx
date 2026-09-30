import { PageHeader } from '@/components/layout/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/** Esqueleto do Início no formato real: cartões do agente e sinais, números do dia e avisos. */
export default function CarregandoInicio() {
  return (
    <div role="status" aria-label="Carregando o Início" className="flex max-w-5xl flex-col gap-6">
      <PageHeader titulo="Início" descricao="Como está o atendimento agora." className="mb-0" />
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i} className="gap-3 p-4">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-8 w-28" />
          </Card>
        ))}
      </div>
      <Skeleton className="h-6 w-40" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="gap-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-1/2" />
          </Card>
        ))}
      </div>
    </div>
  );
}
