import type { CompradorCadastrado, PedidoVendaSalvo } from '@escritorio/core';
import { FilterX } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { BarraSelecao, DataTable } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/empty-state';
import { variantesBotao } from '@/components/ui/button';
import { COLUNA_DA_ORDEM, ORDEM_PADRAO, ORDENS, lerFiltrosDemandas, temFiltro, type FiltrosDemandas } from '@/lib/demandas';
import { filtrarConsulta } from '@/lib/demandas-consulta';
import { pendenciasCsvBling } from '@/lib/resumo-pedido';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { faixaDaConsulta, hrefComParams, lerOrdem, lerPagina, paginar, PARAM_PAGINA, valorParam, type Paginacao, type ParamsBusca } from '@/lib/tabela-url';
import { AtualizarAoVivo } from '../atendimento/atualizar-ao-vivo';
import { BarraDemandas } from './barra-demandas';
import { COLUNAS_LISTA, colunasDemandas, paraLinhaDemanda, type LinhaDemanda } from './colunas-demandas';
import { DetalheDemanda, type DemandaAberta } from './detalhe-demanda';
import { ExportarSelecionadas } from './exportar-selecionadas';
import { EsqueletoDemanda, PainelDemanda } from './painel-demanda';

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

  const [{ data: setores }, { data: pessoas }, total, novas, resolvendo, comCliente, vencidas] = await Promise.all([
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('usuarios').select('id, nome, ativo').order('nome'),
    contar(),
    contar({ status: ['aberto'] }),
    contar({ status: ['em_andamento'] }),
    contar({ status: ['aguardando_cliente'] }),
    contar({ vencidas: true }),
  ]);

  const totalN = total.count ?? 0;
  let paginacao = paginar(totalN, lerPagina(params), POR_PAGINA);
  const pagina_ = (p: Paginacao) => {
    const [de, ate] = faixaDaConsulta(p, POR_PAGINA);
    return filtrarConsulta(sb.from('demandas_lista').select(COLUNAS_LISTA), f, u.id, agora)
      .order(COLUNA_DA_ORDEM[ordem.coluna]!, { ascending: ordem.direcao === 'asc', nullsFirst: false })
      .order('numero', { ascending: false })
      .range(de, ate);
  };
  let resultado = total.error ? { data: null, error: total.error } : await pagina_(paginacao);
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
      <PageHeader titulo="Gestão das demandas" contagem={totalN} />
      <BarraDemandas
        params={params}
        f={f}
        contagens={{ aberto: novas.count, em_andamento: resolvendo.count, aguardando_cliente: comCliente.count, vencidas: vencidas.count }}
        setores={setores ?? []}
        pessoas={pessoas ?? []}
        euId={u.id}
        ordem={ordem}
      />
      <DataTable
        rotulo="Demandas"
        linhas={linhas}
        colunas={colunasDemandas(agora)}
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

      {/* Sempre montado: abre na hora com esqueleto ao clicar na linha; o detalhe chega à parte (Suspense). */}
      <PainelDemanda demandaId={f.demanda} hrefFechar={hrefDemanda(null)}>
        {f.demanda && (
          <Suspense key={f.demanda} fallback={<EsqueletoDemanda />}>
            <DetalheCarregado sb={sb} id={f.demanda} podeCsv={podeCsv} />
          </Suspense>
        )}
      </PainelDemanda>
    </section>
  );
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

async function DetalheCarregado({ sb, id, podeCsv }: { sb: Sb; id: string; podeCsv: boolean }) {
  const aberta = await lerDemanda(sb, id);
  return <DetalheDemanda demanda={aberta?.demanda ?? null} comprador={aberta?.comprador ?? null} podeCsv={podeCsv} />;
}

/** Demanda do painel lateral, com a linha do tempo e o cadastro do comprador (como no CSV do Bling). RLS vale. */
async function lerDemanda(sb: Sb, id: string): Promise<{ demanda: DemandaAberta; comprador: CompradorCadastrado | null } | null> {
  const { data: d } = await sb.from('chamados')
    .select('id, numero, titulo, resumo, status, criado_em, conversa_id, fora_do_contrato, pedido_venda, setores(nome), usuarios(nome), clientes(id, razao_social, nome_fantasia, cnpj), chamado_eventos(tipo, texto, criado_em, usuarios(nome))')
    .eq('id', id).order('criado_em', { referencedTable: 'chamado_eventos' }).maybeSingle();
  if (!d) return null;
  const unidade = (d.pedido_venda as PedidoVendaSalvo | null)?.unidade_id ?? null;
  const { data: comprador } = unidade
    ? await sb.from('parceiros_unidades').select(COLUNAS_COMPRADOR).eq('id', unidade).maybeSingle()
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
