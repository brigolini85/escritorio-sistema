import { PEDIDOS_POR_ARQUIVO_BLING, type CompradorCadastrado, type PedidoVendaSalvo } from '@escritorio/core';
import { FilterX } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { BarraSelecao, DataTable } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/empty-state';
import { variantesBotao } from '@/components/ui/button';
import type { StatusDemanda } from '@/components/patterns/status-badge';
import { COLUNA_DA_ORDEM, ORDEM_PADRAO, ORDENS, lerFiltrosDemandas, temFiltro, type FiltrosDemandas, type Prioridade, type Visao } from '@/lib/demandas';
import { filtrarConsulta } from '@/lib/demandas-consulta';
import { pendenciasCsvBling } from '@/lib/resumo-pedido';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { faixaDaConsulta, hrefComParams, lerOrdem, lerPagina, paginar, PARAM_PAGINA, valorParam, type Paginacao, type ParamsBusca } from '@/lib/tabela-url';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { BotaoAssumir, type PessoaSetor } from './acoes-demanda';
import { AlternarVisao } from './alternar-visao';
import { BarraDemandas } from './barra-demandas';
import { COLUNAS_LISTA, colunasDemandas, paraLinhaDemanda, type LinhaDemanda } from './colunas-demandas';
import { DetalheDemanda, type DemandaAberta } from './detalhe-demanda';
import { ExportarSelecionadas } from './exportar-selecionadas';
import { EsqueletoDemanda, PainelDemanda } from './painel-demanda';
import { QuadroDemandas, type ColunaQuadro } from './quadro-demandas';
import { RodapeDemandas } from './rodape-demandas';

const POR_PAGINA = 50;
const COLUNAS_COMPRADOR = 'id, razao_social, nome_unidade, cnpj, endereco, numero, complemento, bairro, cidade, uf, cep, telefone';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

/**
 * Gestão das demandas (spec 6): tabela com duas informações por coluna, busca, filtros rápidos com contador e filtros
 * avançados, todos na URL (lib/demandas). O RLS limita cada pessoa aos setores dela. ?demanda=<id> abre o painel lateral.
 */
export default async function Demandas({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const params = await searchParams;
  const u = await obterUsuario();
  // CSV do Bling só para quem pode "Corrigir pedidos de nota e gerar CSV do Bling" (o administrador sempre pode).
  const podeCsv = temPermissao(u, 'emitir_notas');
  // O próprio id em ?responsavel= vira "eu" também na URL, para a etiqueta dizer "Responsável: eu".
  if (valorParam(params, 'responsavel') === u.id) redirect(`/demandas${hrefComParams(params, { responsavel: 'eu', [PARAM_PAGINA]: valorParam(params, PARAM_PAGINA) })}`);
  const f = lerFiltrosDemandas(params, u.id);
  const ordem = lerOrdem(params, ORDENS.map((o) => o.coluna), ORDEM_PADRAO)!;
  const agora = new Date();
  const sb = await supabaseServidor();

  const contar = (mudanca: Partial<FiltrosDemandas> = {}) =>
    filtrarConsulta(sb.from('demandas_lista').select('id', { count: 'exact', head: true }), { ...f, ...mudanca }, u.id, agora);

  const [{ data: perfil }, { data: setores }, { data: pessoas }, total, novas, resolvendo, comCliente, vencidas, pedidos] = await Promise.all([
    sb.from('usuarios').select('visao_demandas').eq('id', u.id).maybeSingle(),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome, ativo, usuario_setores(setor_id)').order('nome'),
    contar(),
    contar({ status: ['aberto'] }),
    contar({ status: ['em_andamento'] }),
    contar({ status: ['aguardando_cliente'] }),
    contar({ vencidas: true }),
    // Pedidos de venda do mesmo filtro (para o CSV Bling); com "Tipo: Outras" não há nenhum.
    podeCsv && f.tipo !== 'outras' ? contar({ tipo: 'venda' }) : Promise.resolve({ count: 0, error: null }),
  ]);
  const visao: Visao = perfil?.visao_demandas === 'quadro' ? 'quadro' : 'tabela';
  const quadro = visao === 'quadro' ? await lerQuadro(sb, f, u.id, agora) : null;
  // Arquivada não recebe demanda nova (Parte B): só ativas nos controles.
  const pessoasSetor = (pessoas ?? []).filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome, setores: p.usuario_setores.map((s) => s.setor_id) }));
  const pedidosVenda = pedidos.count ?? 0;
  const partesBling = Math.ceil(pedidosVenda / PEDIDOS_POR_ARQUIVO_BLING);

  const totalN = total.count ?? 0;
  let paginacao = paginar(totalN, lerPagina(params), POR_PAGINA);
  const pagina_ = (p: Paginacao) => {
    const [de, ate] = faixaDaConsulta(p, POR_PAGINA);
    return filtrarConsulta(sb.from('demandas_lista').select(COLUNAS_LISTA), f, u.id, agora)
      .order(COLUNA_DA_ORDEM[ordem.coluna]!, { ascending: ordem.direcao === 'asc', nullsFirst: false })
      .order('numero', { ascending: false })
      .range(de, ate);
  };
  let resultado = quadro || total.error
    ? { data: [] as Parameters<typeof paraLinhaDemanda>[0][], error: quadro ? null : total.error }
    : await pagina_(paginacao);
  // A lista encolheu entre a contagem e a página (tempo real): volta para a primeira página em vez de mostrar erro.
  if (resultado.error?.code === 'PGRST103') {
    paginacao = paginar(totalN, 1, POR_PAGINA);
    resultado = await pagina_(paginacao);
  }

  const linhas = await comPendencias(sb, resultado.data ?? [], podeCsv);
  const pagina = paginacao.pagina > 1 ? paginacao.pagina : null;
  const hrefDemanda = (id: string | null) => `/demandas${hrefComParams(params, { demanda: id, [PARAM_PAGINA]: pagina })}`;
  const filtrosAtivos = temFiltro(f);

  return (
    <section>
      <AtualizarAoVivo />
      <PageHeader titulo="Gestão das demandas" contagem={totalN} acoes={<AlternarVisao atual={visao} />} />
      <BarraDemandas
        params={params}
        f={f}
        contagens={{ aberto: novas.count, em_andamento: resolvendo.count, aguardando_cliente: comCliente.count, vencidas: vencidas.count }}
        setores={setores ?? []}
        pessoas={(pessoas ?? []).map((p) => ({ id: p.id, nome: p.nome, ativo: p.ativo }))}
        euId={u.id}
        mostrarStatus={!quadro}
        ordem={quadro ? undefined : ordem}
      />
      {quadro ? (
        <QuadroDemandas
          colunas={quadro}
          hrefs={Object.fromEntries(quadro.flatMap((c) => c.cartoes).map((d) => [d.id, hrefDemanda(d.id)]))}
          agora={agora.toISOString()}
        />
      ) : (
        <>
          <DataTable
            rotulo="Demandas"
            linhas={linhas}
            colunas={colunasDemandas(agora, (d) => (!d.responsavelId && d.status !== 'concluido' ? <BotaoAssumir id={d.id} numero={d.numero} /> : null))}
            chave={(d) => d.id}
            params={params}
            paginacao={paginacao}
            selecionavel={podeCsv}
            rotuloSelecao={(d) => `Selecionar demanda #${d.numero}`}
            acoesEmMassa={<BarraSelecao><ExportarSelecionadas pedidos={Object.fromEntries(linhas.filter((d) => d.temPedido).map((d) => [d.id, d.pendencias]))} /></BarraSelecao>}
            hrefLinha={(d) => hrefDemanda(d.id)}
            linhaAtiva={f.demanda}
            faixa={(d) => d.prioridade === 'urgente' || d.vencida}
            erro={resultado.error ? 'Não consegui carregar as demandas agora.' : undefined}
            vazio={(
              <EmptyState
                icone={FilterX}
                titulo="Nenhuma demanda neste filtro."
                descricao={filtrosAtivos ? 'Tire um filtro ou limpe todos.' : 'Quando o agente ou a equipe abrir uma demanda, ela aparece aqui.'}
                acao={filtrosAtivos ? <Link href="/demandas" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Limpar filtros</Link> : undefined}
              />
            )}
          />
          <RodapeDemandas params={params} partesBling={partesBling} pedidosVenda={pedidosVenda} />
        </>
      )}

      {/* Sempre montado: abre na hora com esqueleto ao clicar na linha; o detalhe chega à parte (Suspense). */}
      <PainelDemanda demandaId={f.demanda} hrefFechar={hrefDemanda(null)}>
        {f.demanda && (
          <Suspense key={f.demanda} fallback={<EsqueletoDemanda />}>
            <DetalheCarregado sb={sb} id={f.demanda} podeCsv={podeCsv} pessoas={pessoasSetor} setores={setores ?? []} agora={agora} />
          </Suspense>
        )}
      </PainelDemanda>
    </section>
  );
}

const POR_COLUNA = 50;
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

/** As 4 colunas do quadro (spec 6.2): os mesmos filtros e busca da tabela, menos os status; Concluída só dos últimos 7 dias. */
async function lerQuadro(sb: Sb, f: FiltrosDemandas, euId: string, agora: Date): Promise<ColunaQuadro[]> {
  const desde = new Date(agora.getTime() - SETE_DIAS_MS).toISOString();
  const coluna = async (status: StatusDemanda, titulo: string): Promise<ColunaQuadro> => {
    const base = filtrarConsulta(sb.from('demandas_lista').select(COLUNAS_LISTA, { count: 'exact' }).eq('status', status), f, euId, agora, { semStatus: true });
    const { data, count } = status === 'concluido'
      ? await base.gte('concluido_em', desde).order('concluido_em', { ascending: false }).limit(POR_COLUNA)
      : await base.order('prazo_em', { ascending: true, nullsFirst: false }).order('numero', { ascending: false }).limit(POR_COLUNA);
    return { status, titulo, total: count ?? 0, cartoes: (data ?? []).map((d) => paraLinhaDemanda(d, [])) };
  };
  return Promise.all([
    coluna('aberto', 'Nova'), coluna('em_andamento', 'Resolvendo'), coluna('aguardando_cliente', 'Com o cliente'), coluna('concluido', 'Concluída · 7 dias'),
  ]);
}

/** Pendências do CSV de cada pedido desta página (mesma conta da rota, com o comprador cadastrado). */
async function comPendencias(sb: Sb, dados: Parameters<typeof paraLinhaDemanda>[0][], podeCsv: boolean): Promise<LinhaDemanda[]> {
  const unidades = podeCsv
    ? [...new Set(dados.flatMap((d) => { const id = (d.pedido_venda as PedidoVendaSalvo | null)?.unidade_id; return id ? [id] : []; }))]
    : [];
  const { data: compradores, error } = unidades.length
    ? await sb.from('parceiros_unidades').select(COLUNAS_COMPRADOR).in('id', unidades)
    : { data: [], error: null };
  if (error) console.error('[demandas] falha ao ler os compradores dos pedidos', error);
  const porUnidade = new Map((compradores ?? []).map((c) => [c.id, c as CompradorCadastrado]));
  return dados.map((d) => {
    const unidade = (d.pedido_venda as PedidoVendaSalvo | null)?.unidade_id;
    // Sem o cadastro do comprador não dá para conferir o pedido: nada de "incompleto" falso (a rota confere de novo).
    const pendencias = !podeCsv || !d.pedido_venda || (unidade && error) ? [] : pendenciasCsvBling(Number(d.numero), d.pedido_venda, unidade ? porUnidade.get(unidade) ?? null : null);
    return paraLinhaDemanda(d, pendencias);
  });
}

async function DetalheCarregado({ sb, id, podeCsv, pessoas, setores, agora }: {
  sb: Sb; id: string; podeCsv: boolean; pessoas: PessoaSetor[]; setores: { id: string; nome: string }[]; agora: Date;
}) {
  const aberta = await lerDemanda(sb, id);
  return (
    <DetalheDemanda demanda={aberta?.demanda ?? null} comprador={aberta?.comprador ?? null} podeCsv={podeCsv}
      pessoas={pessoas} setores={setores} contatos={aberta?.contatos ?? []} agora={agora} />
  );
}

/** Demanda do painel lateral (visão demandas_lista), com a linha do tempo, os contatos da empresa e o comprador. RLS vale. */
async function lerDemanda(sb: Sb, id: string): Promise<{ demanda: DemandaAberta; comprador: CompradorCadastrado | null; contatos: { id: string; nome: string }[] } | null> {
  const { data: d } = await sb.from('demandas_lista').select('*').eq('id', id).maybeSingle();
  if (!d) return null;
  const unidade = (d.pedido_venda as PedidoVendaSalvo | null)?.unidade_id ?? null;
  const [{ data: eventos }, { data: cliente }, { data: vinculos }, { data: comprador }] = await Promise.all([
    sb.from('chamado_eventos').select('tipo, texto, criado_em, usuarios(nome)').eq('chamado_id', id).order('criado_em'),
    d.cliente_id ? sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj').eq('id', d.cliente_id).maybeSingle() : Promise.resolve({ data: null }),
    d.cliente_id
      ? sb.from('contato_clientes').select('contatos!inner(id, nome, ativo)').eq('cliente_id', d.cliente_id).eq('contatos.ativo', true)
      : Promise.resolve({ data: [] as { contatos: { id: string; nome: string; ativo: boolean } }[] }),
    unidade ? sb.from('parceiros_unidades').select(COLUNAS_COMPRADOR).eq('id', unidade).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return {
    demanda: {
      id: d.id!, numero: Number(d.numero), titulo: d.titulo ?? '', descricao: d.resumo ?? '', status: d.status as StatusDemanda,
      prioridade: (d.prioridade ?? 'normal') as Prioridade, prazo: d.prazo_em, pausadoDesde: d.prazo_pausado_desde, concluidaEm: d.concluido_em,
      criadoEm: d.criado_em!, origem: d.origem ?? 'agente', criadoPorNome: d.criado_por_nome, conversaId: d.conversa_id,
      foraDoContrato: Boolean(d.fora_do_contrato), pedidoVenda: d.pedido_venda, setorId: d.setor_id, setor: d.setor,
      responsavelId: d.responsavel_id, responsavelNome: d.responsavel, contatoId: d.contato_id,
      empresa: cliente ? { id: cliente.id, nome: cliente.nome_fantasia ?? cliente.razao_social, cnpj: cliente.cnpj } : null,
      eventos: (eventos ?? []).map((e) => ({ tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario: e.usuarios?.nome ?? null })),
    },
    comprador: (comprador as CompradorCadastrado | null) ?? null,
    contatos: (vinculos ?? []).map((v) => ({ id: v.contatos.id, nome: v.contatos.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
  };
}
