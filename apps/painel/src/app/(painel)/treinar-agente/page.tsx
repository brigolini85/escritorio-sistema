import { Building2, FilterX, GraduationCap, LockKeyhole, Plus, SearchX } from 'lucide-react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { DataTable, type ColunaTabela } from '@/components/patterns/data-table';
import { EmptyState } from '@/components/patterns/empty-state';
import type { EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { FilterBar } from '@/components/patterns/filter-bar';
import { PainelLateralUrl } from '@/components/patterns/painel-lateral-url';
import { RelativeTime } from '@/components/patterns/relative-time';
import { StatusBadge } from '@/components/patterns/status-badge';
import { Badge } from '@/components/ui/badge';
import { variantesBotao } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SheetBody, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { medirOrientacoes, ROTULO_TIPO, TIPOS, type TipoOrientacao } from '@/lib/orientacoes';
import { lerEmPaginas } from '@/lib/paginas';
import { obterUsuario, temPermissao } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { hrefComParams, lerOrdem, ordenarLinhas, valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { AbasOrientacao } from './abas-orientacao';
import { restaurarVersao, salvarOrientacao } from './acoes';
import { ChaveOrientacao } from './chave-orientacao';
import { AVISO_EMPRESAS_INCOMPLETAS, ehUuid, lerFiltrosOrientacoes, MODELOS, modeloPorId, nomeEmpresa, normalizarBusca, opcaoEmpresa } from './esquemas';
import { FormularioOrientacao, type DadosFormulario, type SetorOpcao } from './formulario-orientacao';
import { HistoricoOrientacao } from './historico-orientacao';
import { MedidorOrientacoes } from './medidor';
import { BotaoTestarAgente } from './testar-agente';
import type { AcaoVersao, Versao } from './versoes';

const ORDENAVEIS = ['titulo', 'atualizada'] as const;
const OPCOES_TIPO = TIPOS.map((t) => ({ valor: t, rotulo: ROTULO_TIPO[t] }));
const OPCOES_VALE = [{ valor: 'todos', rotulo: 'Todos os clientes' }, { valor: 'empresa', rotulo: 'Uma empresa' }, { valor: 'setor', rotulo: 'Um setor' }];
const OPCOES_ATIVO = [{ valor: 'ligadas', rotulo: 'Ligadas' }, { valor: 'desligadas', rotulo: 'Desligadas' }];

type Linha = DadosFormulario & {
  id: string;
  atualizadaEm: string;
  atualizadaPor: string | null;
  empresa: { nome: string; ativa: boolean } | null;
  setor: { nome: string; ativo: boolean } | null;
};

function ValePara({ l }: { l: Pick<Linha, 'empresa' | 'setor' | 'clienteId' | 'setorId'> }) {
  if (l.clienteId) {
    return (
      <span className="flex min-w-0 items-center gap-1.5">
        <Building2 aria-hidden size={16} strokeWidth={1.75} className="shrink-0 text-muted" />
        <span className="truncate">{l.empresa?.nome ?? 'Empresa removida'}</span>
        {l.empresa && !l.empresa.ativa && <Badge variant="outline">arquivada</Badge>}
      </span>
    );
  }
  if (l.setorId) {
    return (
      <span className="flex items-center gap-1.5">
        <span className="truncate">Setor {l.setor?.nome ?? 'removido'}</span>
        {l.setor && !l.setor.ativo && <Badge variant="outline" title="Setor inativo: a orientação não entra no atendimento">setor inativo</Badge>}
      </span>
    );
  }
  return <span className="text-muted">Todos os clientes</span>;
}

function EsqueletoOrientacao() {
  return (
    <>
      <SheetHeader>
        <SheetTitle className="sr-only">Carregando a orientação</SheetTitle>
        <SheetDescription className="sr-only">Os dados aparecem em instantes.</SheetDescription>
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-48" />
      </SheetHeader>
      <SheetBody role="status" aria-label="Carregando a orientação" className="flex flex-col gap-4 py-4">
        <Skeleton className="h-14 w-full" />
        <div className="grid gap-2 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-40 w-full" />
      </SheetBody>
    </>
  );
}

/** Sem a marcação "Treinar o agente" (e sem ser administrador): diz quem pode liberar. */
function SemPermissao() {
  return (
    <section>
      <PageHeader titulo="Treinar o agente" />
      <Card>
        <EmptyState
          icone={LockKeyhole}
          titulo="Você não tem acesso a esta tela."
          descricao={'Quem libera é o administrador: na tela Usuários, ele marca "Treinar o agente" no seu cadastro.'}
          acao={<Link href="/inicio" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Voltar para o Início</Link>}
        />
      </Card>
    </section>
  );
}

/**
 * Treinar o agente: orientações em português que o agente de clientes segue no atendimento (spec 2026-09-30 §5).
 * Admin ou quem tem "treinar_agente". Filtros (?tipo, ?vale, ?ativo, ?q) e ordem na URL; ?orientacao=<id>|nova abre o
 * painel (formulário + histórico); ?modelo= preenche a nova com um exemplo; ?aba=historico abre no histórico.
 * Gravações pelas funções do banco (salvar/alternar/restaurar_orientacao) com a sessão da pessoa; erros em ?erro=.
 */
export default async function TreinarAgente({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const u = await obterUsuario();
  if (!temPermissao(u, 'treinar_agente')) return <SemPermissao />;
  const params = await searchParams;
  const erro = valorParam(params, 'erro');
  const f = lerFiltrosOrientacoes(params);
  const ordem = lerOrdem(params, ORDENAVEIS, { coluna: 'atualizada', direcao: 'desc' })!;
  const pedido = valorParam(params, 'orientacao');
  const aberta = pedido === 'nova' ? 'nova' : ehUuid(pedido) ? pedido : null;
  const sb = await supabaseServidor();

  const colunasVersao = 'id, acao, titulo, texto, tipo, cliente_id, setor_id, ativo, criado_em, usuarios(nome)';
  const [lista, { data: setores }, leituraEmpresas, leituraVersoes] = await Promise.all([
    // Todas, de 1000 em 1000 (o PostgREST corta em 1000 sem avisar).
    lerEmPaginas((de, ate) => sb.from('orientacoes_agente')
      .select('id, titulo, texto, tipo, cliente_id, setor_id, ativo, atualizado_em, clientes(razao_social, nome_fantasia, ativo), setores(nome, ativo), atualizador:usuarios!orientacoes_agente_atualizado_por_fkey(nome)')
      .order('atualizado_em', { ascending: false }).order('id').range(de, ate)),
    sb.from('setores').select('id, nome, ativo').order('nome'),
    // Empresas ativas para o formulário (painel aberto), todas as páginas; a inativa da orientação aberta vem à parte.
    // O Dialog "Testar o agente" carrega as suas ao abrir (empresasParaTeste).
    aberta
      ? lerEmPaginas((de, ate) => sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo').eq('ativo', true)
        .order('razao_social').order('id').range(de, ate))
      : Promise.resolve({ data: [], error: null, parcial: false }),
    // Histórico inteiro (a mais nova primeiro; id desempata versões do mesmo instante).
    aberta && aberta !== 'nova'
      ? lerEmPaginas((de, ate) => sb.from('orientacoes_agente_versoes').select(colunasVersao)
        .eq('orientacao_id', aberta).order('criado_em', { ascending: false }).order('id', { ascending: false }).range(de, ate))
      : Promise.resolve({ data: [], error: null, parcial: false }),
  ]);
  const { data: orientacoes, error: erroLista } = lista;
  const clientes = leituraEmpresas.data;
  const versoes = leituraVersoes.data;
  if (erroLista) console.error('[treinar-agente] falha ao ler as orientações', erroLista);
  if (lista.parcial) console.error('[treinar-agente] lista de orientações incompleta (limite de páginas)');
  if (leituraEmpresas.error || leituraEmpresas.parcial) console.error('[treinar-agente] lista de empresas incompleta', leituraEmpresas.error ?? 'limite de páginas');
  if (leituraVersoes.error || leituraVersoes.parcial) console.error('[treinar-agente] histórico incompleto', leituraVersoes.error ?? 'limite de páginas');
  // Avisos discretos: a tela continua com o que veio.
  const avisoLista = lista.parcial ? 'A lista mostra só parte das orientações (são muitas); use a busca e os filtros.' : null;
  const avisoEmpresas = leituraEmpresas.error || leituraEmpresas.parcial ? AVISO_EMPRESAS_INCOMPLETAS : null;
  const avisoHistorico = leituraVersoes.error || leituraVersoes.parcial ? 'Não consegui carregar o histórico inteiro: as versões mais antigas podem faltar.' : null;

  const todas: Linha[] = (orientacoes ?? []).map((o) => ({
    id: o.id, titulo: o.titulo, texto: o.texto, tipo: o.tipo as TipoOrientacao, clienteId: o.cliente_id, setorId: o.setor_id,
    ativo: o.ativo, atualizadaEm: o.atualizado_em, atualizadaPor: o.atualizador?.nome ?? null,
    empresa: o.clientes ? { nome: nomeEmpresa(o.clientes), ativa: o.clientes.ativo } : null,
    setor: o.setores ? { nome: o.setores.nome, ativo: o.setores.ativo } : null,
  }));

  const opcoesSetor: SetorOpcao[] = setores ?? [];
  // Empresa inativa não conversa: as orientações dela não pesam em conversa nenhuma.
  const medidor = medirOrientacoes(todas.filter((l) => !l.clienteId || l.empresa?.ativa), opcoesSetor.filter((s) => s.ativo).map((s) => s.id));
  const empresaMaisPesada = medidor.empresa ? todas.find((l) => l.clienteId === medidor.empresa!.id)?.empresa?.nome ?? null : null;

  const busca = normalizarBusca(f.q);
  const filtradas = todas.filter((l) => (!f.tipo || l.tipo === f.tipo)
    && (!f.vale || (f.vale === 'empresa' ? l.clienteId !== null : f.vale === 'setor' ? l.setorId !== null : !l.clienteId && !l.setorId))
    && (!f.ativo || l.ativo === (f.ativo === 'ligadas'))
    && (!busca || normalizarBusca(`${l.titulo} ${l.texto} ${l.empresa?.nome ?? ''} ${l.setor?.nome ?? ''}`).includes(busca)));
  const linhas = ordenarLinhas(filtradas, (l) => (ordem.coluna === 'titulo' ? l.titulo : new Date(l.atualizadaEm)), ordem.direcao);

  const href = (mudancas: Record<string, string | null>) => `/treinar-agente${hrefComParams(params, { erro: null, ...mudancas })}`;
  const hrefPainel = (id: string | null, extra: Record<string, string | null> = {}) => href({ orientacao: id, modelo: null, aba: null, ...extra });
  const filtrando = Boolean(f.tipo || f.vale || f.ativo || f.q);

  const colunas: ColunaTabela<Linha>[] = [
    {
      id: 'titulo', titulo: 'Título', ordenavel: true, className: 'w-full min-w-56 max-w-0',
      celula: (l) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-foreground">{l.titulo}</span>
          <span className="truncate text-xs text-muted">{l.texto}</span>
        </span>
      ),
    },
    { id: 'tipo', titulo: 'Tipo', celula: (l) => <StatusBadge tipo="orientacao" status={l.tipo} /> },
    { id: 'vale', titulo: 'Vale para', className: 'max-w-56', celula: (l) => <ValePara l={l} /> },
    { id: 'ativo', titulo: 'Situação', celula: (l) => <ChaveOrientacao id={l.id} titulo={l.titulo} ligada={l.ativo} /> },
    {
      id: 'atualizada', titulo: 'Atualizada', ordenavel: true,
      celula: (l) => (
        <span className="text-muted">
          <RelativeTime data={l.atualizadaEm} />
          {l.atualizadaPor && <> por {l.atualizadaPor}</>}
        </span>
      ),
    },
  ];

  const vazioSemNada = (
    <div className="flex flex-col items-center gap-4 px-4 py-8">
      <EmptyState
        icone={GraduationCap}
        className="py-0"
        titulo="Nenhuma orientação ainda."
        descricao="Escreva como o agente deve atender, as regras do escritório e o que fazer em situações específicas. Comece por um exemplo:"
      />
      <ul className="grid w-full max-w-3xl gap-3 sm:grid-cols-3">
        {MODELOS.map((m) => (
          <li key={m.id}>
            <Link
              href={href({ orientacao: 'nova', modelo: m.id, aba: null })}
              scroll={false}
              className="flex h-full flex-col gap-2 rounded-lg border border-border bg-surface p-3 text-left whitespace-normal transition-colors duration-150 ease-out hover:border-brand hover:bg-surface-muted"
            >
              <StatusBadge tipo="orientacao" status={m.tipo} className="self-start" />
              <span className="font-medium text-foreground">{m.titulo}</span>
              <span className="text-sm text-muted">{m.texto}</span>
              <span className="mt-auto text-sm font-medium text-brand">Usar este exemplo</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

  // Painel lateral: nova (com ou sem modelo) ou uma orientação da lista.
  const atual = aberta && aberta !== 'nova' ? todas.find((l) => l.id === aberta) ?? null : null;
  // Empresas citadas fora da lista de ativas (a da orientação aberta e as dos retratos do histórico): só o nome.
  const ativas = new Set(clientes.map((c) => c.id));
  const faltando = [...new Set([atual?.clienteId, ...versoes.map((v) => v.cliente_id)])].filter((id): id is string => Boolean(id) && !ativas.has(id!));
  const { data: outras } = faltando.length
    ? await sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo').in('id', faltando)
    : { data: [] };
  const todasEmpresas = [...clientes, ...(outras ?? [])];
  const empresas: EmpresaOpcao[] = [...clientes, ...(outras ?? []).filter((c) => c.id === atual?.clienteId)]
    .map(opcaoEmpresa);
  const nomes = {
    empresa: new Map(todasEmpresas.map((c) => [c.id, nomeEmpresa(c)])),
    setor: new Map(opcoesSetor.map((s) => [s.id, s.nome])),
  };
  const valeParaTexto = (v: Pick<Versao, 'clienteId' | 'setorId'>) => (v.clienteId
    ? `Empresa ${nomes.empresa.get(v.clienteId) ?? 'removida'}`
    : v.setorId ? `Setor ${nomes.setor.get(v.setorId) ?? 'removido'}` : 'Todos os clientes');
  const listaVersoes: Versao[] = versoes.map((v) => ({
    id: v.id, acao: v.acao as AcaoVersao, titulo: v.titulo, texto: v.texto, tipo: v.tipo as TipoOrientacao, clienteId: v.cliente_id,
    setorId: v.setor_id, ativo: v.ativo, usuario: v.usuarios?.nome ?? null, criadoEm: v.criado_em,
  }));
  const modelo = modeloPorId(valorParam(params, 'modelo'));
  const aviso = erro ? <AvisoErro erro={erro} /> : undefined;

  return (
    <section>
      <PageHeader
        titulo="Treinar o agente"
        contagem={linhas.length}
        descricao="Orientações que o agente de clientes segue no WhatsApp. As regras fixas dele continuam valendo; o que você liga aqui vale a partir da próxima mensagem."
        acoes={(
          <>
            <BotaoTestarAgente />
            <Link href={hrefPainel('nova')} scroll={false} className={variantesBotao({ size: 'sm' })}>
              <Plus aria-hidden size={16} strokeWidth={1.75} />
              Nova orientação
            </Link>
          </>
        )}
      />
      {erro && !aberta && <div className="mb-4"><AvisoErro erro={erro} /></div>}
      {avisoLista && <p className="mb-3 text-sm text-warning">{avisoLista}</p>}
      <MedidorOrientacoes medidor={medidor} empresa={empresaMaisPesada} />

      <FilterBar
        className="mb-3"
        total={linhas.length}
        busca={{ placeholder: 'Buscar por título, texto ou empresa' }}
        filtros={[
          { param: 'tipo', rotulo: 'Tipo', todos: 'Todos', opcoes: OPCOES_TIPO },
          { param: 'vale', rotulo: 'Vale para', todos: 'Qualquer um', opcoes: OPCOES_VALE },
          { param: 'ativo', rotulo: 'Situação', todos: 'Ligadas e desligadas', opcoes: OPCOES_ATIVO },
        ]}
      />

      <DataTable
        rotulo="Orientações do agente"
        linhas={linhas}
        colunas={colunas}
        chave={(l) => l.id}
        params={params}
        ordem={ordem}
        hrefLinha={(l) => hrefPainel(l.id)}
        linhaAtiva={atual?.id ?? null}
        erro={erroLista ? 'Não consegui carregar as orientações agora.' : undefined}
        vazio={todas.length === 0 && !filtrando ? vazioSemNada : (
          <EmptyState
            icone={FilterX}
            titulo="Nenhuma orientação neste filtro."
            descricao="Tente outro filtro ou limpe a busca."
            acao={<Link href="/treinar-agente" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Limpar filtros</Link>}
          />
        )}
      />

      <PainelLateralUrl param="orientacao" id={aberta} hrefFechar={hrefPainel(null)} esqueleto={<EsqueletoOrientacao />} className="sm:max-w-2xl" protegerAlteracoes>
        {aberta === 'nova' ? (
          <>
            <SheetHeader>
              <SheetTitle>Nova orientação</SheetTitle>
              <SheetDescription>
                {modelo ? `Exemplo "${modelo.titulo}" preenchido: ajuste ao jeito do escritório.` : 'Ela começa desligada; ligue quando estiver pronta.'}
              </SheetDescription>
            </SheetHeader>
            <FormularioOrientacao
              key={`nova-${modelo?.id ?? ''}-${erro ?? ''}`}
              acao={salvarOrientacao.bind(null, null, href({ orientacao: 'nova', aba: null }))}
              orientacao={modelo ? { titulo: modelo.titulo, texto: modelo.texto, tipo: modelo.tipo, clienteId: null, setorId: null, ativo: false } : undefined}
              empresas={empresas}
              avisoEmpresas={avisoEmpresas}
              setores={opcoesSetor}
              aviso={aviso}
            />
          </>
        ) : aberta && (atual ? (
          <>
            <SheetHeader>
              <SheetTitle>{atual.titulo}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                <StatusBadge tipo="orientacao" status={atual.tipo} />
                <Badge variant={atual.ativo ? 'agent-active' : 'outline'}>{atual.ativo ? 'Ligada' : 'Desligada'}</Badge>
                <span className="text-sm">{valeParaTexto(atual)}</span>
              </SheetDescription>
            </SheetHeader>
            <AbasOrientacao
              key={`${atual.id}-${valorParam(params, 'aba') ?? ''}`}
              abaInicial={valorParam(params, 'aba') === 'historico' ? 'historico' : 'orientacao'}
              versoes={listaVersoes.length}
              formulario={(
                <FormularioOrientacao
                  // Voltou do servidor com dados novos (salvou ou restaurou) ou com erro: o formulário recomeça.
                  key={JSON.stringify([atual.titulo, atual.texto, atual.tipo, atual.clienteId, atual.setorId, atual.ativo, erro])}
                  acao={salvarOrientacao.bind(null, atual.id, hrefPainel(atual.id))}
                  orientacao={atual}
                  idOrientacao={atual.id}
                  avisoEmpresas={avisoEmpresas}
                  empresas={empresas}
                  setores={opcoesSetor}
                  aviso={aviso}
                />
              )}
              historico={(
                <div className="flex flex-col gap-3 py-3">
                  {erro && <div className="px-4"><AvisoErro erro={erro} /></div>}
                  {avisoHistorico && <p className="px-4 text-sm text-warning">{avisoHistorico}</p>}
                  <HistoricoOrientacao
                    versoes={listaVersoes}
                    atual={atual}
                    valePara={valeParaTexto}
                    restaurar={(versaoId) => restaurarVersao.bind(null, versaoId, hrefPainel(atual.id, { aba: 'historico' }))}
                  />
                </div>
              )}
            />
          </>
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Orientação não encontrada</SheetTitle>
              <SheetDescription className="sr-only">A orientação do endereço não existe mais.</SheetDescription>
            </SheetHeader>
            <SheetBody><EmptyState icone={SearchX} titulo="Não encontrei esta orientação." descricao="Ela pode ter sido apagada junto com a empresa ou o setor." /></SheetBody>
          </>
        ))}
      </PainelLateralUrl>
    </section>
  );
}
