import { PageHeader } from '@/components/layout/page-header';
import { DataTableCarregando } from '@/components/patterns/data-table';

/** Primeira entrada em Usuários: esqueleto no formato da tabela. */
export default function CarregandoUsuarios() {
  return (
    <section>
      <PageHeader titulo="Usuários e permissões" />
      <DataTableCarregando rotulo="Carregando usuários" colunas={['Nome / Cargo', 'Setores', 'Nível de Demandas', 'Último acesso', 'Situação']} />
    </section>
  );
}
