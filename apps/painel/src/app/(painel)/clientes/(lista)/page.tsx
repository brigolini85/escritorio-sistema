import { Building2, FilterX, Pencil, Plus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type ColunaTabela } from '@/components/patterns/data-table';
import { DocumentText } from '@/components/patterns/document-text';
import { EmptyState } from '@/components/patterns/empty-state';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { FilterBar } from '@/components/patterns/filter-bar';
import { LinkArquivados, TelaArquivados } from '@/components/patterns/lista-arquivados';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { contarArquivados } from '@/lib/arquivados';
import { termoSeguroPostgrest } from '@/lib/busca';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { faixaDaConsulta, lerOrdem, lerPagina, paginar, valorParam, type Paginacao, type ParamsBusca } from '@/lib/tabela-url';

const POR_PAGINA = 50;
const ORDENAVEIS = ['razao_social', 'cnpj'] as const;

type Linha = { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string; ativo: boolean; agente_pausado: boolean; contatos: number };

/** O que o filtro da lista usa do construtor de consultas (os mesmos filtros na contagem e na página). */
type Filtravel<Q> = { or(filtro: string): Q; eq(coluna: string, valor: boolean): Q };

/** Empresas atendidas pelo escritório. Busca por nome ou CNPJ (?q=, como antes), ordem e página na URL; ?ver=arquivados mostra os arquivados. */
export default async function Clientes({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const params = await searchParams;
  const u = await obterUsuario();
  const pode = temNivel(u, 'clientes', 'editar');
  if (valorParam(params, 'ver') === 'arquivados') {
    return <TelaArquivados tipo="cliente" titulo="Clientes arquivados" voltar={{ rotulo: 'Clientes', href: '/clientes' }} pode={pode} />;
  }
  const q = termoSeguroPostgrest(valorParam(params, 'q'));
  const ordem = lerOrdem(params, ORDENAVEIS, { coluna: 'razao_social', direcao: 'asc' })!;
  const sb = await supabaseServidor();

  const filtrar = <Q extends Filtravel<Q>>(consulta: Q): Q => {
    let r = consulta;
    if (q) r = r.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%,cnpj.ilike.%${q.replace(/\D/g, '') || q}%`);
    // Arquivado sai da lista (spec 5.1).
    r = r.eq('ativo', true);
    return r;
  };
  const [contados, arquivados] = await Promise.all([
    filtrar(sb.from('clientes').select('id', { count: 'exact', head: true })),
    contarArquivados(sb, 'cliente'),
  ]);
  const total = contados.count ?? 0;
  const lerPaginaDaLista = (p: Paginacao) => {
    const [de, ate] = faixaDaConsulta(p, POR_PAGINA);
    return filtrar(sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo, agente_pausado, contato_clientes(count)'))
      .order(ordem.coluna, { ascending: ordem.direcao === 'asc' }).order('id').range(de, ate);
  };
  let paginacao = paginar(total, lerPagina(params), POR_PAGINA);
  let resultado = contados.error ? { data: null, error: contados.error } : await lerPaginaDaLista(paginacao);
  // A lista encolheu entre a contagem e a página: volta para a primeira em vez de mostrar erro.
  if (resultado.error?.code === 'PGRST103') {
    paginacao = paginar(total, 1, POR_PAGINA);
    resultado = await lerPaginaDaLista(paginacao);
  }
  if (resultado.error) console.error('[clientes] falha ao ler a lista', resultado.error);

  const linhas: Linha[] = (resultado.data ?? []).map((c) => ({
    id: c.id, razao_social: c.razao_social, nome_fantasia: c.nome_fantasia, cnpj: c.cnpj, ativo: c.ativo,
    agente_pausado: c.agente_pausado, contatos: c.contato_clientes[0]?.count ?? 0,
  }));

  const colunas: ColunaTabela<Linha>[] = [
    {
      id: 'razao_social', titulo: 'Razão social', ordenavel: true, className: 'w-full min-w-56 max-w-0',
      celula: (c) => <Link href={`/clientes/${c.id}`} className="block truncate font-medium text-foreground hover:underline">{c.razao_social}</Link>,
    },
    { id: 'fantasia', titulo: 'Nome fantasia', className: 'max-w-48', celula: (c) => c.nome_fantasia ? <span className="block truncate">{c.nome_fantasia}</span> : <span className="text-subtle">—</span> },
    { id: 'cnpj', titulo: 'CNPJ', ordenavel: true, celula: (c) => <DocumentText valor={c.cnpj} tipo="cnpj" className="text-muted" /> },
    { id: 'contatos', titulo: 'Contatos', alinhar: 'direita', celula: (c) => <span className="tabular text-muted">{c.contatos}</span> },
    {
      id: 'situacao', titulo: 'Situação',
      celula: (c) => (
        c.agente_pausado
          ? <Badge variant="agent-paused" title="O agente não responde os contatos desta empresa">Agente pausado</Badge>
          : <span className="text-subtle">—</span>
      ),
    },
  ];

  const filtrando = Boolean(q);

  return (
    <section>
      <PageHeader
        titulo="Clientes"
        contagem={total}
        descricao="Empresas atendidas pelo escritório, com contatos, produtos, preços e documentos."
        acoes={(
          <>
            <LinkArquivados href="/clientes?ver=arquivados" total={arquivados} />
            {pode && (
              <Link href="/clientes/novo" className={variantesBotao({ size: 'sm' })}>
                <Plus aria-hidden size={16} strokeWidth={1.75} />
                Novo cliente
              </Link>
            )}
          </>
        )}
      />
      <FilterBar
        className="mb-3"
        total={total}
        busca={{ placeholder: 'Buscar por nome ou CNPJ' }}
      />
      <DataTable
        rotulo="Clientes"
        linhas={linhas}
        colunas={colunas}
        chave={(c) => c.id}
        params={params}
        ordem={ordem}
        paginacao={paginacao}
        hrefLinha={(c) => `/clientes/${c.id}`}
        acoesLinha={pode ? (c) => (
          <span className="flex items-center justify-end gap-1">
            <Link href={`/clientes/${c.id}`} aria-label={`Editar ${c.razao_social}`} className={variantesBotao({ variant: 'outline', size: 'icon' })}>
              <Pencil aria-hidden size={16} strokeWidth={1.75} />
            </Link>
            <ExcluirCadastro tipo="cliente" id={c.id} nome={c.razao_social} />
          </span>
        ) : undefined}
        erro={resultado.error ? 'Não consegui carregar os clientes agora.' : undefined}
        vazio={filtrando ? (
          <EmptyState
            icone={FilterX}
            titulo="Nenhuma empresa encontrada."
            descricao="Confira o nome ou o CNPJ, ou limpe os filtros."
            acao={<Link href="/clientes" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Limpar filtros</Link>}
          />
        ) : (
          <EmptyState
            icone={Building2}
            titulo="Nenhuma empresa cadastrada."
            descricao={pode ? 'Cadastre a primeira empresa para o agente reconhecer os contatos dela.' : 'Quem pode editar clientes cadastra as empresas.'}
            acao={pode ? <Link href="/clientes/novo" className={variantesBotao({ size: 'sm' })}>Cadastrar empresa</Link> : undefined}
          />
        )}
      />
    </section>
  );
}
