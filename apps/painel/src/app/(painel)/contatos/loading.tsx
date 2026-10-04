import { PageHeader } from '@/components/layout/page-header';
import { DataTableCarregando } from '@/components/patterns/data-table';
import { Skeleton } from '@/components/ui/skeleton';

/** Primeira entrada em Contatos: esqueleto no formato da tela. */
export default function CarregandoContatos() {
  return (
    <section>
      <PageHeader titulo="Contatos" />
      <div className="mb-3 flex flex-col gap-3">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-36" />
          <Skeleton className="h-8 w-36" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <DataTableCarregando rotulo="Carregando contatos" colunas={['Contato', 'Empresas', 'Marcações', 'Último contato', 'Agente']} />
    </section>
  );
}
