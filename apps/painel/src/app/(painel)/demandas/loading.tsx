import { PageHeader } from '@/components/layout/page-header';
import { DataTableCarregando } from '@/components/patterns/data-table';
import { Skeleton } from '@/components/ui/skeleton';

/** Primeira entrada em Demandas: esqueleto no formato da tela (troca de filtro mantém a tabela antiga até a nova chegar). */
export default function CarregandoDemandas() {
  return (
    <section>
      <PageHeader titulo="Gestão das demandas" />
      <div className="mb-3 flex gap-1.5">
        {[16, 20, 16, 20].map((w, i) => <Skeleton key={i} className={w === 16 ? 'h-8 w-16 rounded-full' : 'h-8 w-20 rounded-full'} />)}
      </div>
      <div className="mb-3 flex gap-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-36" />)}
      </div>
      <DataTableCarregando rotulo="Carregando demandas" colunas={['Assunto [Nº]', 'Status · Prioridade · Prazo', 'Responsável interno', 'Últ. atualização', 'Setor']} />
    </section>
  );
}
