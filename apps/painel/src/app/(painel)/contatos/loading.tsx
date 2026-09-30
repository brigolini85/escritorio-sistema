import { PageHeader } from '@/components/layout/page-header';
import { DataTableCarregando } from '@/components/patterns/data-table';
import { Skeleton } from '@/components/ui/skeleton';

/** Primeira entrada em Contatos: esqueleto no formato da tela. */
export default function CarregandoContatos() {
  return (
    <section>
      <PageHeader titulo="Contatos" />
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-36" />
      </div>
      <DataTableCarregando rotulo="Carregando contatos" colunas={['Nome', 'Telefone', 'Empresas', 'Marcações', 'Agente']} />
    </section>
  );
}
