import { PEDIDOS_POR_ARQUIVO_BLING, type CompradorCadastrado, type PedidoVendaSalvo } from '@escritorio/core';
import { FilterX, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { BlingExportButton } from '@/components/patterns/bling-export-button';
import { BarraSelecao, DataTable, type ColunaTabela } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/empty-state';
import { FilterBar } from '@/components/patterns/filter-bar';
import { RelativeTime } from '@/components/patterns/relative-time';
import { StatusBadge, type StatusDemanda } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { inicioDoPeriodo, lerFiltrosDemandas, OPCOES_PERIODO, OPCOES_STATUS, OPCOES_TIPO, temFiltroAlemDoSetor } from '@/lib/demandas';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { hrefComParams, lerOrdem, lerPagina, paginar, PARAM_PAGINA, type ParamsBusca } from '@/lib/tabela-url';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { DetalheDemanda, type DemandaAberta } from './detalhe-demanda';
import { ExportarSelecionadas } from './exportar-selecionadas';
import { PainelDemanda } from './painel-demanda';

const POR_PAGINA = 50;
const ORDENAVEIS = ['numero', 'aberta'] as const;

type Linha = {
  id: string;
  numero: number;
  titulo: string;
  resumo: string;
  status: StatusDemanda;
  criado_em: string;
  conversa_id: string | null;
  fora_do_contrato: boolean;
  temPedido: boolean;
  setor: string | null;
  responsavel: string | null;
  empresa: string | null;
};

/**
 * Demandas abertas pelo agente ou pela equipe. O RLS já limita cada pessoa aos setores dela.
 * Filtros na URL: ?setor= (o de sempre, também usado pelo CSV do Bling) e os novos status, responsavel, tipo, periodo
 * (lib/demandas). ?demanda=<id> abre o painel lateral.
 */
export default async function Demandas({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const params = await searchParams;
  const u = await obterUsuario();
  // CSV do Bling só para quem pode "Corrigir pedidos de nota e gerar CSV do Bling" (o administrador sempre pode).
  const podeCsv = temPermissao(u, 'emitir_notas');
  const f = lerFiltrosDemandas(params);
  const setor = f.setor;
  const ordem = lerOrdem(params, ORDENAVEIS, { coluna: 'aberta', direcao: 'desc' })!;
  const paginaPedida = lerPagina(params);
  const sb = await supabaseServidor();

  let consulta = sb.from('chamados')
    .select('id, numero, titulo, resumo, status, criado_em, conversa_id, fora_do_contrato, pedido_venda, setores(nome), clientes(razao_social, nome_fantasia), usuarios(nome)', { count: 'exact' });
  if (setor === 'triagem') consulta = consulta.is('setor_id', null);
  else if (setor !== 'todos') consulta = consulta.eq('setor_id', setor);
  consulta = f.status ? consulta.eq('status', f.status) : consulta.neq('status', 'concluido');
  if (f.responsavel === 'sem') consulta = consulta.is('responsavel_id', null);
  else if (f.responsavel) consulta = consulta.eq('responsavel_id', f.responsavel === 'eu' ? u.id : f.responsavel);
  if (f.tipo === 'venda') consulta = consulta.not('pedido_venda', 'is', null);
  else if (f.tipo === 'outras') consulta = consulta.is('pedido_venda', null);
  const desde = inicioDoPeriodo(f.periodo, new Date());
  if (desde) consulta = consulta.gte('criado_em', desde);
  const inicio = (paginaPedida - 1) * POR_PAGINA;
  consulta = consulta.order(ordem.coluna === 'numero' ? 'numero' : 'criado_em', { ascending: ordem.direcao === 'asc' }).range(inicio, inicio + POR_PAGINA - 1);

  // Exportação para o Bling: todas as demandas de venda abertas do filtro de setor (a rota só conhece o setor), 500 pedidos por arquivo.
  let contagem = sb.from('chamados').select('id', { count: 'exact', head: true }).neq('status', 'concluido').not('pedido_venda', 'is', null);
  if (setor === 'triagem') contagem = contagem.is('setor_id', null);
  else if (setor !== 'todos') contagem = contagem.eq('setor_id', setor);

  const [{ data: setores }, { data: pessoas }, resultado, { count: pedidosVenda }, aberta] = await Promise.all([
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome').eq('ativo', true).order('nome'),
    consulta,
    podeCsv ? contagem : Promise.resolve({ count: 0 }),
    f.demanda ? lerDemanda(sb, f.demanda) : Promise.resolve(null),
  ]);
  const partesBling = Math.ceil((pedidosVenda ?? 0) / PEDIDOS_POR_ARQUIVO_BLING);
  const total = resultado.count ?? 0;
  const paginacao = paginar(total, paginaPedida, POR_PAGINA);

  const linhas: Linha[] = (resultado.data ?? []).map((d) => ({
    id: d.id, numero: d.numero, titulo: d.titulo, resumo: d.resumo, status: d.status, criado_em: d.criado_em,
    conversa_id: d.conversa_id, fora_do_contrato: d.fora_do_contrato, temPedido: d.pedido_venda !== null,
    setor: d.setores?.nome ?? null, responsavel: d.usuarios?.nome ?? null,
    empresa: d.clientes?.nome_fantasia ?? d.clientes?.razao_social ?? null,
  }));

  const nomeSetor = setor === 'todos' ? 'todos os setores' : setor === 'triagem' ? 'Triagem' : setores?.find((s) => s.id === setor)?.nome ?? 'o setor escolhido';
  const chips = [{ valor: 'todos', rotulo: 'Todos' }, ...(setores ?? []).map((s) => ({ valor: s.id, rotulo: s.nome })), { valor: 'triagem', rotulo: 'Triagem' }];
  // Abrir e fechar o painel mantém a página da tabela (hrefComParams volta à página 1 quando outro parâmetro muda).
  const pagina = paginacao.pagina > 1 ? paginacao.pagina : null;
  const hrefDemanda = (id: string | null) => `/demandas${hrefComParams(params, { demanda: id, [PARAM_PAGINA]: pagina })}`;

  const colunas: ColunaTabela<Linha>[] = [
    { id: 'numero', titulo: 'Número', ordenavel: true, className: 'w-20', celula: (d) => <span className="tabular text-muted">#{d.numero}</span> },
    { id: 'empresa', titulo: 'Empresa', className: 'max-w-44', celula: (d) => d.empresa
      ? <span className="block truncate">{d.empresa}</span>
      : <span className="text-subtle">Não identificada</span> },
    {
      id: 'assunto', titulo: 'Assunto', className: 'w-full min-w-56 max-w-0',
      celula: (d) => (
        <div className="flex min-w-0 flex-col">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium text-foreground">{d.titulo}</span>
            {d.temPedido && <Badge variant="brand">Pedido de nota</Badge>}
            {d.fora_do_contrato && <Badge variant="warning">Fora do contrato</Badge>}
          </span>
          {d.resumo && <span className="truncate text-xs text-muted">{d.resumo}</span>}
        </div>
      ),
    },
    { id: 'setor', titulo: 'Setor', celula: (d) => d.setor ?? <span className="text-muted">Triagem</span> },
    { id: 'responsavel', titulo: 'Responsável', celula: (d) => d.responsavel ?? <Badge variant="warning">Sem responsável</Badge> },
    { id: 'aberta', titulo: 'Aberta', ordenavel: true, celula: (d) => <RelativeTime data={d.criado_em} className="text-muted" /> },
    { id: 'status', titulo: 'Status', celula: (d) => <StatusBadge tipo="demanda" status={d.status} /> },
  ];

  const filtrosAtivos = temFiltroAlemDoSetor(f);

  return (
    <section>
      <AtualizarAoVivo />
      <PageHeader
        titulo="Demandas"
        descricao="Pedidos dos clientes que precisam da equipe, abertos pelo agente ou por alguém do escritório."
        acoes={podeCsv && partesBling > 0 ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex flex-wrap justify-end gap-2">
              {Array.from({ length: partesBling }, (_, i) => (
                <BlingExportButton
                  key={i}
                  href={`/api/csv-bling?setor=${setor}&parte=${i + 1}`}
                  rotulo={`Exportar CSV Bling${partesBling > 1 ? ` (parte ${i + 1})` : ''}`}
                />
              ))}
            </div>
            <p className="text-right text-xs text-muted">
              {pedidosVenda === 1 ? '1 pedido de nota em aberto' : `${pedidosVenda} pedidos de nota em aberto`} em {nomeSetor}
              {filtrosAtivos && <><br />O arquivo leva todos eles: os outros filtros não entram na exportação.</>}
            </p>
          </div>
        ) : undefined}
      />

      <nav aria-label="Setor" className="mb-3 flex flex-wrap gap-1.5">
        {chips.map((c) => {
          const atual = c.valor === setor;
          return (
            <Link
              key={c.valor}
              href={`/demandas${hrefComParams(params, { setor: c.valor, demanda: null })}`}
              aria-current={atual ? 'page' : undefined}
              scroll={false}
              className={cn(
                'inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors duration-150 ease-out',
                atual ? 'border-brand bg-brand text-brand-foreground' : 'border-border bg-surface text-foreground hover:bg-surface-muted',
              )}
            >
              {c.rotulo}
            </Link>
          );
        })}
      </nav>

      <FilterBar
        className="mb-3"
        total={total}
        filtros={[
          { param: 'status', rotulo: 'Status', todos: 'Em aberto', opcoes: OPCOES_STATUS },
          { param: 'responsavel', rotulo: 'Responsável', todos: 'Qualquer um', opcoes: [
            { valor: 'eu', rotulo: 'Comigo' }, { valor: 'sem', rotulo: 'Sem responsável' },
            ...(pessoas ?? []).filter((p) => p.id !== u.id).map((p) => ({ valor: p.id, rotulo: p.nome })),
          ] },
          { param: 'tipo', rotulo: 'Tipo', todos: 'Todos', opcoes: OPCOES_TIPO },
          { param: 'periodo', rotulo: 'Aberta', todos: 'Qualquer data', opcoes: OPCOES_PERIODO },
        ]}
      />

      <DataTable
        rotulo="Demandas"
        linhas={linhas}
        colunas={colunas}
        chave={(d) => d.id}
        params={params}
        ordem={ordem}
        paginacao={paginacao}
        selecionavel={podeCsv}
        rotuloSelecao={(d) => `Selecionar demanda #${d.numero}`}
        acoesEmMassa={<BarraSelecao><ExportarSelecionadas comPedido={linhas.filter((d) => d.temPedido).map((d) => d.id)} /></BarraSelecao>}
        hrefLinha={(d) => hrefDemanda(d.id)}
        linhaAtiva={f.demanda}
        acoesLinha={(d) => d.conversa_id ? (
          <Link
            href={`/atendimento/${d.conversa_id}`}
            aria-label="Abrir conversa"
            title="Abrir conversa"
            className={cn(variantesBotao({ variant: 'ghost', size: 'icon' }), 'size-8 text-muted')}
          >
            <MessageSquare aria-hidden size={16} strokeWidth={1.75} />
          </Link>
        ) : null}
        erro={resultado.error ? 'Não consegui carregar as demandas agora.' : undefined}
        vazio={(
          <EmptyState
            icone={FilterX}
            titulo={f.status === 'concluido' ? 'Nenhuma demanda concluída neste filtro.' : 'Nenhuma demanda aberta neste filtro.'}
            descricao={filtrosAtivos || setor !== 'todos' ? 'Tente outro setor ou limpe os filtros.' : 'Quando o agente ou a equipe abrir uma demanda, ela aparece aqui.'}
            acao={filtrosAtivos || setor !== 'todos'
              ? <Link href="/demandas" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Limpar filtros</Link>
              : undefined}
          />
        )}
      />

      {f.demanda && (
        <PainelDemanda key={f.demanda} hrefFechar={hrefDemanda(null)}>
          <DetalheDemanda demanda={aberta?.demanda ?? null} comprador={aberta?.comprador ?? null} podeCsv={podeCsv} />
        </PainelDemanda>
      )}
    </section>
  );
}

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/** Demanda do painel lateral, com a linha do tempo e o cadastro do comprador (como no CSV do Bling). RLS vale. */
async function lerDemanda(sb: Sb, id: string): Promise<{ demanda: DemandaAberta; comprador: CompradorCadastrado | null } | null> {
  const { data: d } = await sb.from('chamados')
    .select('id, numero, titulo, resumo, status, criado_em, conversa_id, fora_do_contrato, pedido_venda, setores(nome), usuarios(nome), clientes(id, razao_social, nome_fantasia, cnpj), chamado_eventos(tipo, texto, criado_em, usuarios(nome))')
    .eq('id', id).order('criado_em', { referencedTable: 'chamado_eventos' }).maybeSingle();
  if (!d) return null;
  const unidade = (d.pedido_venda as PedidoVendaSalvo | null)?.unidade_id ?? null;
  const { data: comprador } = unidade
    ? await sb.from('parceiros_unidades').select('id, razao_social, nome_unidade, cnpj, endereco, numero, complemento, bairro, cidade, uf, cep, telefone').eq('id', unidade).maybeSingle()
    : { data: null };
  return {
    demanda: {
      id: d.id, numero: d.numero, titulo: d.titulo, resumo: d.resumo, status: d.status, criado_em: d.criado_em,
      conversa_id: d.conversa_id, fora_do_contrato: d.fora_do_contrato, pedido_venda: d.pedido_venda,
      setor: d.setores?.nome ?? null, responsavel: d.usuarios?.nome ?? null,
      empresa: d.clientes ? { id: d.clientes.id, nome: d.clientes.nome_fantasia ?? d.clientes.razao_social, cnpj: d.clientes.cnpj } : null,
      eventos: d.chamado_eventos.map((e) => ({ tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario: e.usuarios?.nome ?? null })),
    },
    comprador: (comprador as CompradorCadastrado | null) ?? null,
  };
}
