import { redirect } from 'next/navigation';
import { textoDoErro } from '@/lib/erro-na-url-servidor';
import { PageHeader } from '@/components/layout/page-header';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { DadosFicha } from '../ficha/dados-ficha';
import { NovoClienteAntigo } from './form-antigo';

// Coluna ou tabela que não existe (Postgres e PostgREST): é o banco sem a migração da H1, não uma falha passageira.
const SEM_MIGRACAO = new Set(['42703', '42P01', 'PGRST204', 'PGRST205']);

/** Novo cliente = a mesma ficha, vazia (spec 7D.1, D25). Sem a migração da Parte H1 no banco, o formulário de hoje (D23). */
export default async function NovoCliente({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const erro = textoDoErro((await searchParams).erro);
  const u = await obterUsuario();
  if (!temNivel(u, 'clientes', 'editar')) redirect('/clientes');
  const sb = await supabaseServidor();
  // GET de verdade (não HEAD): o HEAD não traz o erro de coluna inexistente no postgrest-js.
  const { error } = await sb.from('clientes').select('logradouro').limit(1);
  if (error && SEM_MIGRACAO.has(error.code)) return <NovoClienteAntigo erro={erro} />;
  if (error) throw new Error(`Não consegui abrir o Novo cliente: ${error.message}`);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        className="mb-0"
        secao="Ficha do cliente"
        titulo="Novo cliente"
        migalhas={[{ rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Novo cliente' }]}
        descricao={<>Depois de salvar, abrem as abas de contatos, produtos e preços. <span aria-hidden className="text-danger">*</span> campos obrigatórios (a ficha salva com pendências).</>}
      />
      <DadosFicha c={null} u={u} />
    </div>
  );
}
