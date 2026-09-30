import { PageHeader } from '@/components/layout/page-header';
import { DataTableCarregando } from '@/components/patterns/data-table';

/** Primeira entrada em Usuários: esqueleto no formato da tabela. */
export default function CarregandoUsuarios() {
  return (
    <section>
      <PageHeader titulo="Usuários" />
      <DataTableCarregando rotulo="Carregando usuários" colunas={['Pessoa', 'E-mail', 'Setores', 'Telefone', 'Pode editar']} />
    </section>
  );
}
