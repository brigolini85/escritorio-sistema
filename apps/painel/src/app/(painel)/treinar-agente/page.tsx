import { GraduationCap, LockKeyhole, SearchX } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { AvisoErro } from '@/components/patterns/aviso-erro';
import { EmptyState } from '@/components/patterns/empty-state';
import type { EmpresaOpcao } from '@/components/patterns/escolher-empresa';
import { StatusBadge } from '@/components/patterns/status-badge';
import { variantesBotao } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { medirOrientacoes, type TipoOrientacao } from '@/lib/orientacoes';
import { lerEmPaginas } from '@/lib/paginas';
import { temNivel } from '@/lib/permissoes';
import { obterUsuario } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { hrefComParams, valorParam, type ParamsBusca } from '@/lib/tabela-url';
import { restaurarVersao, salvarOrientacao } from './acoes';
import { CabecalhoEditor, RegrasFixas } from './cabecalho-editor';
import { EditorOrientacao, type SetorOpcao } from './editor-orientacao';
import { AVISO_EMPRESAS_INCOMPLETAS, ehUuid, lerFiltrosOrientacoes, MODELOS, modeloPorId, nomeEmpresa, normalizarBusca, opcaoEmpresa } from './esquemas';
import { Hidratado } from './hidratado';
import { HistoricoTabela } from './historico-tabela';
import { ListaOrientacoes, type ItemLista } from './lista-orientacoes';
import { Simulador } from './simulador';
import { contarSituacao, ehEnsinada, linhasHistorico } from './tela';
import type { AcaoVersao, Versao } from './versoes';

type Linha = ItemLista & { criadaEm: string; criadaPor: string | null };

/** Sem a marcação "Treinar o agente" (e sem ser administrador): diz quem pode liberar. */
function SemPermissao() {
  return (
    <section>
      <PageHeader titulo="Treinar o agente" />
      <Card>
        <EmptyState
          icone={LockKeyhole}
          titulo="Você não tem acesso a esta tela."
          descricao={'Quem libera é o administrador: na tela Usuários, ele escolhe "Sim" em "Treinar o agente" no seu cadastro.'}
          acao={<Link href="/inicio" className={variantesBotao({ variant: 'outline', size: 'sm' })}>Voltar para o Início</Link>}
        />
      </Card>
    </section>
  );
}

/**
 * Treinar o agente, Opção B "Editor com simulador" (spec 7C.5): lista enxuta, editor no meio e simulador sempre visível.
 * Admin ou quem tem Treinar o agente. ?orientacao=<id>|nova abre no editor; ?modelo= preenche a nova; ?ativo= e ?q=
 * filtram (?tipo= e ?vale= continuam valendo); ?aba=historico é aceito (o histórico está sempre à vista).
 * Gravações pelas funções do banco (salvar/alternar/restaurar_orientacao); testes por criar_simulacao — regras de hoje.
 */
export default async function TreinarAgente({ searchParams }: { searchParams: Promise<ParamsBusca> }) {
  const u = await obterUsuario();
  if (!temNivel(u, 'treinar', 'sim')) return <SemPermissao />;
  const params = await searchParams;
  const erro = valorParam(params, 'erro');
  const f = lerFiltrosOrientacoes(params);
  const pedido = valorParam(params, 'orientacao');
  const aberta = pedido === 'nova' ? 'nova' : ehUuid(pedido) ? pedido : null;
  const sb = await supabaseServidor();

  const colunasVersao = 'id, acao, titulo, texto, tipo, cliente_id, setor_id, ativo, criado_em, usuarios(nome)';
  const [lista, criacoes, { data: setores }, leituraEmpresas, leituraVersoes] = await Promise.all([
    // Todas, de 1000 em 1000 (o PostgREST corta em 1000 sem avisar).
    lerEmPaginas((de, ate) => sb.from('orientacoes_agente')
      .select('id, titulo, texto, tipo, cliente_id, setor_id, ativo, atualizado_em, criado_em, clientes(razao_social, nome_fantasia, ativo), setores(nome, ativo), criador:usuarios!orientacoes_agente_criado_por_fkey(nome)')
      .order('atualizado_em', { ascending: false }).order('id').range(de, ate)),
    // Texto da criação: diz se veio do "Ensinar o agente" (D8). Falhou: vale o texto atual.
    lerEmPaginas((de, ate) => sb.from('orientacoes_agente_versoes').select('orientacao_id, texto').eq('acao', 'criar')
      .order('criado_em').order('id').range(de, ate)),
    sb.from('setores').select('id, nome, ativo').order('nome'),
    // Empresas ativas para o editor e o simulador (D24); a inativa da orientação aberta vem à parte.
    lerEmPaginas((de, ate) => sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo').eq('ativo', true)
      .order('razao_social').order('id').range(de, ate)),
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
  if (criacoes.error || criacoes.parcial) console.error('[treinar-agente] textos de criação incompletos', criacoes.error ?? 'limite de páginas');
  if (leituraEmpresas.error || leituraEmpresas.parcial) console.error('[treinar-agente] lista de empresas incompleta', leituraEmpresas.error ?? 'limite de páginas');
  if (leituraVersoes.error || leituraVersoes.parcial) console.error('[treinar-agente] histórico incompleto', leituraVersoes.error ?? 'limite de páginas');
  const avisoLista = lista.parcial ? 'A lista mostra só parte das orientações (são muitas); use a busca.' : null;
  const avisoEmpresas = leituraEmpresas.error || leituraEmpresas.parcial ? AVISO_EMPRESAS_INCOMPLETAS : null;
  const avisoHistorico = leituraVersoes.error || leituraVersoes.parcial ? 'Não consegui carregar o histórico inteiro: as versões mais antigas podem faltar.' : null;

  const textoDaCriacao = new Map(criacoes.data.map((c) => [c.orientacao_id, c.texto]));
  const todas: Linha[] = (orientacoes ?? []).map((o) => ({
    id: o.id, titulo: o.titulo, texto: o.texto, tipo: o.tipo as TipoOrientacao, clienteId: o.cliente_id, setorId: o.setor_id, ativo: o.ativo,
    ensinada: ehEnsinada(textoDaCriacao.get(o.id) ?? o.texto),
    empresa: o.clientes ? { nome: nomeEmpresa(o.clientes), ativa: o.clientes.ativo } : null,
    setor: o.setores ? { nome: o.setores.nome, ativo: o.setores.ativo } : null,
    criadaEm: o.criado_em, criadaPor: o.criador?.nome ?? null,
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
  const filtrando = Boolean(f.tipo || f.vale || f.ativo || f.q);

  const href = (mudancas: Record<string, string | null>) => `/treinar-agente${hrefComParams(params, { erro: null, ...mudancas })}`;
  const hrefPainel = (id: string | null, extra: Record<string, string | null> = {}) => href({ orientacao: id, modelo: null, aba: null, ...extra });

  const atual = aberta && aberta !== 'nova' ? todas.find((l) => l.id === aberta) ?? null : null;
  // Empresas citadas fora da lista de ativas (a da orientação aberta e as dos retratos do histórico): só o nome.
  const ativas = new Set(clientes.map((c) => c.id));
  const faltando = [...new Set([atual?.clienteId, ...versoes.map((v) => v.cliente_id)])].filter((id): id is string => Boolean(id) && !ativas.has(id!));
  const { data: outras } = faltando.length
    ? await sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, ativo').in('id', faltando)
    : { data: [] };
  const todasEmpresas = [...clientes, ...(outras ?? [])];
  const empresas: EmpresaOpcao[] = [...clientes, ...(outras ?? []).filter((c) => c.id === atual?.clienteId)].map(opcaoEmpresa);
  const nomes = {
    empresa: new Map(todasEmpresas.map((c) => [c.id, nomeEmpresa(c)])),
    setor: new Map(opcoesSetor.map((s) => [s.id, s.nome])),
  };
  const valeParaTexto = (v: Pick<Versao, 'clienteId' | 'setorId'>) => (v.clienteId
    ? `Empresa ${nomes.empresa.get(v.clienteId) ?? 'removida'}`
    : v.setorId ? `Setor ${nomes.setor.get(v.setorId) ?? 'removido'}` : 'Todos os clientes');
  // No histórico, sem repetir "Empresa <nome>" do alto do editor.
  const valeParaCurto = (v: Pick<Versao, 'clienteId' | 'setorId'>) => (v.clienteId
    ? nomes.empresa.get(v.clienteId) ?? 'empresa removida'
    : v.setorId ? `setor ${nomes.setor.get(v.setorId) ?? 'removido'}` : 'todos os clientes');
  const listaVersoes: Versao[] = versoes.map((v) => ({
    id: v.id, acao: v.acao as AcaoVersao, titulo: v.titulo, texto: v.texto, tipo: v.tipo as TipoOrientacao, clienteId: v.cliente_id,
    setorId: v.setor_id, ativo: v.ativo, usuario: v.usuarios?.nome ?? null, criadoEm: v.criado_em,
  }));
  const modelo = modeloPorId(valorParam(params, 'modelo'));
  const aviso = erro ? <AvisoErro erro={erro} /> : undefined;

  let conteudoEditor: ReactNode;
  if (aberta === 'nova') {
    conteudoEditor = (
      <>
        <header className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-wide text-info">Desligada até você ligar</p>
          <h2 className="text-2xl font-extrabold text-foreground">Nova orientação</h2>
          <p className="text-sm text-muted">
            {modelo ? `Exemplo "${modelo.titulo}" preenchido: ajuste ao jeito do escritório.` : 'Escreva, teste no simulador ao lado e salve desligada ou já ligada.'}
          </p>
        </header>
        <EditorOrientacao
          key={`nova-${modelo?.id ?? ''}-${erro ?? ''}`}
          acao={salvarOrientacao.bind(null, null, href({ orientacao: 'nova', aba: null }))}
          orientacao={modelo ? { titulo: modelo.titulo, texto: modelo.texto, tipo: modelo.tipo, clienteId: null, setorId: null } : undefined}
          empresas={empresas}
          avisoEmpresas={avisoEmpresas}
          setores={opcoesSetor}
          aviso={aviso}
        />
        <RegrasFixas />
      </>
    );
  } else if (aberta && atual) {
    conteudoEditor = (
      <>
        <CabecalhoEditor
          id={atual.id} titulo={atual.titulo} tipo={atual.tipo} ativo={atual.ativo} ensinada={atual.ensinada}
          valePara={valeParaTexto(atual)} criadaPor={atual.criadaPor} criadaEm={atual.criadaEm}
        />
        <EditorOrientacao
          // Voltou do servidor com outro conteúdo (salvou ou restaurou) ou com erro: recomeça. Sem `ativo`: ligar pelo alto não apaga o rascunho (D12).
          key={JSON.stringify([atual.titulo, atual.texto, atual.tipo, atual.clienteId, atual.setorId, erro])}
          acao={salvarOrientacao.bind(null, atual.id, hrefPainel(atual.id))}
          orientacao={atual}
          empresas={empresas}
          avisoEmpresas={avisoEmpresas}
          setores={opcoesSetor}
          aviso={aviso}
        />
        <HistoricoTabela
          linhas={linhasHistorico(listaVersoes, atual, atual.ensinada)}
          versoes={listaVersoes}
          ligada={atual.ativo}
          valePara={valeParaCurto}
          restaurar={(versaoId) => restaurarVersao.bind(null, versaoId, hrefPainel(atual.id, { aba: 'historico' }))}
          aviso={avisoHistorico ? <p className="text-sm text-warning">{avisoHistorico}</p> : undefined}
        />
        <RegrasFixas />
      </>
    );
  } else if (aberta) {
    conteudoEditor = <EmptyState icone={SearchX} titulo="Não encontrei esta orientação." descricao="Ela pode ter sido apagada junto com a empresa ou o setor." />;
  } else if (todas.length === 0 && !filtrando && !erroLista) {
    conteudoEditor = (
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
  } else {
    conteudoEditor = (
      <EmptyState
        icone={GraduationCap}
        titulo="Escolha uma orientação na lista."
        descricao="Ou crie uma nova. Enquanto isso, o simulador ao lado testa o agente com as orientações ligadas."
        acao={<Link href={hrefPainel('nova')} scroll={false} className={variantesBotao({ variant: 'outline', size: 'sm' })}>Criar orientação</Link>}
      />
    );
  }

  return (
    <div className="-m-6 flex flex-col lg:altura-trabalho lg:flex-row">
      <Hidratado />
      <ListaOrientacoes
        linhas={filtradas}
        total={todas.length}
        contagem={contarSituacao(todas)}
        filtro={f.ativo}
        tipo={f.tipo}
        vale={f.vale}
        busca={f.q}
        aberta={atual?.id ?? null}
        orientacaoNaUrl={aberta}
        medidor={medidor}
        empresaMaisPesada={empresaMaisPesada}
        erro={erroLista ? 'Não consegui carregar as orientações agora.' : null}
        aviso={avisoLista}
        hrefOrientacao={(id) => hrefPainel(id)}
        hrefFiltro={(v) => href({ ativo: v })}
        hrefNova={hrefPainel('nova')}
      />
      <section aria-label="Editor da orientação" className="flex min-w-0 flex-1 flex-col gap-4 bg-background p-6 lg:overflow-y-auto">
        {erro && !aberta && <AvisoErro erro={erro} />}
        {conteudoEditor}
      </section>
      <Simulador
        key={aberta ?? 'nenhuma'}
        aberta={aberta === 'nova' ? 'nova' : atual ? 'salva' : null}
        idOrientacao={atual?.id ?? null}
        salva={atual ? { titulo: atual.titulo, texto: atual.texto, tipo: atual.tipo, clienteId: atual.clienteId, setorId: atual.setorId, ativo: atual.ativo } : null}
        empresas={clientes.map(opcaoEmpresa)}
        avisoEmpresas={avisoEmpresas}
      />
    </div>
  );
}
