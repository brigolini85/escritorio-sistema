import { PageHeader } from '@/components/layout/page-header';
import { DataTableCarregando } from '@/components/patterns/data-table';
import { Skeleton } from '@/components/ui/skeleton';

/** Primeira entrada em Treinar o agente: esqueleto do medidor e da tabela. */
export default function CarregandoTreinarAgente() {
  return (
    <section>
      <PageHeader titulo="Treinar o agente" />
      <Skeleton className="mb-4 h-24 w-full rounded-lg" />
      <DataTableCarregando rotulo="Carregando orientações" colunas={['Título', 'Tipo', 'Vale para', 'Situação', 'Atualizada']} />
    </section>
  );
}
