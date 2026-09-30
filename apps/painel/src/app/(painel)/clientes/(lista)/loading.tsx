import { PageHeader } from '@/components/layout/page-header';
import { DataTableCarregando } from '@/components/patterns/data-table';
import { Skeleton } from '@/components/ui/skeleton';

/** Primeira entrada em Clientes: esqueleto no formato da tela (trocar filtro mantém a tabela antiga até a nova chegar). */
export default function CarregandoClientes() {
  return (
    <section>
      <PageHeader titulo="Clientes" />
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-36" />
      </div>
      <DataTableCarregando rotulo="Carregando clientes" colunas={['Razão social', 'Nome fantasia', 'CNPJ', 'Contatos', 'Situação']} />
    </section>
  );
}
