import { FilterX, Pencil, UserPlus, UsersRound } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { DataTable, type ColunaTabela } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/empty-state';
import { ExcluirCadastro } from '@/components/patterns/excluir-cadastro';
import { FilterBar } from '@/components/patterns/filter-bar';
import { LinkArquivados, TelaArquivados } from '@/components/patterns/lista-arquivados';
import { PainelLateralUrl } from '@/components/patterns/painel-lateral-url';
import { SwitchAgenteContato } from '@/components/patterns/switch-agente-contato';
import { Button, variantesBotao } from '@/components/ui/button';
import { FormCadastroContato } from '@/components/patterns/form-cadastro-contato';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { contarArquivados } from '@/lib/arquivados';
import { termoSeguroPostgrest } from '@/lib/busca';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { faixaDaConsulta, hrefComParams, lerOrdem, lerPagina, paginar, PARAM_PAGINA, valorParam, type Paginacao, type ParamsBusca } from '@/lib/tabela-url';
import { alternarAgenteContato } from '../atendimento/acoes';
import { cadastrarContato } from './acoes';
import { DetalheContato, EsqueletoContato } from './detalhe-contato';
import { MarcacoesContato, nomeEmpresa, type Vinculo } from './marcacoes';

const POR_PAGINA = 50;
const OPCOES_AGENTE = [{ valor: 'atende', rotulo: 'Agente atende' }, { valor: 'desligado', rotulo: 'Agente desligado' }];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Linha = { id: string; nome: string; telefone: string; agente_pausado: boolean; ativo: boolean; vinculos: Vinculo[] };
type Filtravel<Q> = { or(filtro: string): Q; eq(coluna: string, valor: boolean): Q };

/**
 * Todos os contatos cadastrados, com as empresas a que estão ligados, as marcações e se o agente atende cada um.
 * Busca (?q=, como antes), filtro do agente, ordem e página na URL; ?contato=<id> abre o painel lateral.
 */
export default async function Contatos({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const params = await searchParams;
  const u = await obterUsuario();
  const pode = temPermissao(u, 'editar_clientes');
  if (valorParam(params, 'ver') === 'arquivados') {
    return <TelaArquivados tipo="contato" titulo="Contatos arquivados" voltar={{ rotulo: 'Contatos', href: '/contatos' }} pode={pode} />;
  }
  const q = termoSeguroPostgrest(valorParam(params, 'q'));
  const agente = valorParam(params, 'agente');
  const aberto = valorParam(params, 'contato');
  const contatoAberto = aberto && UUID.test(aberto) ? aberto : null;
  const ordem = lerOrdem(params, ['nome'], { coluna: 'nome', direcao: 'asc' })!;
  const sb = await supabaseServidor();

  const filtrar = <Q extends Filtravel<Q>>(consulta: Q): Q => {
    // Arquivado sai da lista (spec 5.1)
    let r = consulta.eq('ativo', true);
    if (q) r = r.or(`nome.ilike.%${q}%,telefone.ilike.%${q.replace(/\D/g, '') || q}%`);
    if (agente === 'atende') r = r.eq('agente_pausado', false);
    else if (agente === 'desligado') r = r.eq('agente_pausado', true);
    return r;
  };
  const contados = await filtrar(sb.from('contatos').select('id', { count: 'exact', head: true }));
  const total = contados.count ?? 0;
  const arquivados = await contarArquivados(sb, 'contato');
  const lerPaginaDaLista = (p: Paginacao) => {
    const [de, ate] = faixaDaConsulta(p, POR_PAGINA);
    return filtrar(sb.from('contatos').select('id, nome, telefone, agente_pausado, ativo, contato_clientes(pode_pedir_nota, pode_atualizar_preco, clientes(id, razao_social, nome_fantasia))'))
      .order('nome', { ascending: ordem.direcao === 'asc' }).order('id').range(de, ate);
  };
  let paginacao = paginar(total, lerPagina(params), POR_PAGINA);
  let resultado = contados.error ? { data: null, error: contados.error } : await lerPaginaDaLista(paginacao);
  if (resultado.error?.code === 'PGRST103') {
    paginacao = paginar(total, 1, POR_PAGINA);
    resultado = await lerPaginaDaLista(paginacao);
  }
  if (resultado.error) console.error('[contatos] falha ao ler a lista', resultado.error);

  const linhas: Linha[] = (resultado.data ?? []).map((c) => ({
    id: c.id, nome: c.nome, telefone: c.telefone, agente_pausado: c.agente_pausado, ativo: c.ativo,
    vinculos: c.contato_clientes.flatMap((v) => (v.clientes
      ? [{ empresaId: v.clientes.id, empresa: nomeEmpresa(v.clientes), podePedirNota: v.pode_pedir_nota, podeMudarPreco: v.pode_atualizar_preco }]
      : [])),
  }));

  // Abrir e fechar o painel mantém a página da tabela.
  const pagina = paginacao.pagina > 1 ? paginacao.pagina : null;
  const hrefContato = (id: string | null) => `/contatos${hrefComParams(params, { contato: id, [PARAM_PAGINA]: pagina })}`;

  const colunas: ColunaTabela<Linha>[] = [
    {
      id: 'nome', titulo: 'Nome', ordenavel: true, className: 'max-w-56',
      celula: (c) => (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-foreground">{c.nome}</span>
        </span>
      ),
    },
    { id: 'telefone', titulo: 'Telefone', celula: (c) => <span className="tabular text-muted">{c.telefone}</span> },
    {
      id: 'empresas', titulo: 'Empresas', className: 'w-full min-w-48 max-w-0',
      celula: (c) => c.vinculos.length === 0 ? <span className="text-subtle">sem empresa</span> : (
        <span className="block truncate">
          {c.vinculos.map((v, i) => (
            <span key={v.empresaId}>
              {i > 0 && ', '}
              <Link href={`/clientes/${v.empresaId}?aba=contatos`} className="text-foreground hover:underline">{v.empresa}</Link>
            </span>
          ))}
        </span>
      ),
    },
    { id: 'marcacoes', titulo: 'Marcações', celula: (c) => <MarcacoesContato vinculos={c.vinculos} vazio={<span className="text-subtle">—</span>} /> },
    {
      id: 'agente', titulo: 'Agente',
      celula: (c) => (
        <SwitchAgenteContato
          acao={alternarAgenteContato.bind(null, c.id, null, c.agente_pausado)}
          desligado={c.agente_pausado}
          nome={c.nome}
          pode={pode}
          mostrarEstado
        />
      ),
    },
  ];
  const filtrando = Boolean(q || agente);

  return (
    <section>
      <PageHeader
        titulo="Contatos"
        contagem={total}
        descricao="Quem fala com o escritório pelo WhatsApp, as empresas de cada um e se o agente atende."
        acoes={(
          <>
            <LinkArquivados href="/contatos?ver=arquivados" total={arquivados} />
            {pode && (
              <a href="#novo-contato" className={variantesBotao({ size: 'sm' })}>
                <UserPlus aria-hidden size={16} strokeWidth={1.75} />
                Novo contato
              </a>
            )}
          </>
        )}
      />
      <FilterBar
        className="mb-3"
        total={total}
        busca={{ placeholder: 'Buscar por nome ou telefone' }}
        filtros={[{ param: 'agente', rotulo: 'Agente', todos: 'Todos', opcoes: OPCOES_AGENTE }]}
      />
      <DataTable
        rotulo="Contatos"
        linhas={linhas}
        colunas={colunas}
        chave={(c) => c.id}
        params={params}
        ordem={ordem}
        paginacao={paginacao}
        acoesLinha={pode ? (c) => (
          // Lápis e arquivar, como em Clientes (imagem 01): o lápis abre o painel do contato.
          <span className="flex items-center justify-end gap-1">
            <Link href={hrefContato(c.id)} scroll={false} aria-label={`Editar ${c.nome}`} className={variantesBotao({ variant: 'outline', size: 'icon' })}>
              <Pencil aria-hidden size={16} strokeWidth={1.75} />
            </Link>
            <ExcluirCadastro tipo="contato" id={c.id} nome={c.nome} />
          </span>
        ) : undefined}
        hrefLinha={(c) => hrefContato(c.id)}
        linhaAtiva={contatoAberto}
        erro={resultado.error ? 'Não consegui carregar os contatos agora.' : undefined}
        vazio={filtrando ? (
          <EmptyState
            icone={FilterX}
            titulo="Nenhum contato encontrado."
            descricao="Confira o nome ou o telefone, ou limpe os filtros."
            acao={<Link href="/contatos" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Limpar filtros</Link>}
          />
        ) : (
          <EmptyState icone={UsersRound} titulo="Nenhum contato cadastrado." descricao="Os contatos aparecem aqui quando alguém os cadastra pela conversa, pela ficha da empresa ou abaixo." />
        )}
      />

      {pode && (
        <Card id="novo-contato" className="mt-6 scroll-mt-20">
          <CardHeader>
            <CardTitle>Cadastrar contato</CardTitle>
            <CardDescription>Com ou sem empresa. Para ligar a uma empresa, abra a empresa em Clientes → aba Contatos → &quot;Vincular contato já cadastrado&quot;.</CardDescription>
          </CardHeader>
          <FormCadastroContato action={cadastrarContato}>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Input name="nome" required placeholder="Nome" aria-label="Nome do contato" autoComplete="off" className="sm:w-56" />
              <Input name="telefone" required placeholder="Telefone (com DDD)" aria-label="Telefone (com DDD)" inputMode="tel" autoComplete="off" className="sm:w-56" />
              <label className="flex items-center gap-2 text-base text-foreground">
                <input type="checkbox" name="agente_atende" defaultChecked className="size-4 shrink-0 accent-brand" />
                O agente atende
              </label>
              <Button type="submit" size="sm" className="sm:ml-auto">Cadastrar contato</Button>
            </CardContent>
          </FormCadastroContato>
        </Card>
      )}

      {/* Sempre montado: abre na hora com esqueleto ao clicar na linha; o detalhe chega à parte (Suspense). */}
      <PainelLateralUrl param="contato" id={contatoAberto} hrefFechar={hrefContato(null)} esqueleto={<EsqueletoContato />} className="sm:max-w-lg">
        {contatoAberto && (
          <Suspense key={contatoAberto} fallback={<EsqueletoContato />}>
            <DetalheContato id={contatoAberto} pode={pode} admin={u.papel === 'admin'} />
          </Suspense>
        )}
      </PainelLateralUrl>
    </section>
  );
}
