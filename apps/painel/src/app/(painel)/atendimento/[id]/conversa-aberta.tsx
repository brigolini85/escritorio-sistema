import type { CompradorCadastrado, PedidoVendaSalvo } from '@escritorio/core';
import { ArrowLeft } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AgentStateIndicator } from '@/components/patterns/agent-state-indicator';
import { estadoDaConversa } from '@/components/patterns/estado-agente';
import { HistoricoRolante } from '@/components/patterns/historico-rolante';
import { MessageBubble, type AutorMensagem } from '@/components/patterns/message-bubble';
import type { StatusDemanda } from '@/components/patterns/status-badge';
import { iniciais } from '@/lib/atendimento';
import { consultaCaixa } from '@/lib/caixa';
import { cartoesDeDecisao, marcosDaConversa, ocultarPedidoDasDecisoes, porQueDasMensagens, turnoDaPassagem, documentosAbertos as documentosAbertosDe, type CartaoDecisao, type DecisaoBruta } from '@/lib/conversa-itens';
import { cn } from '@/lib/cn';
import { mascararTelefone } from '@/lib/formatos';
import { linhaDoTempo } from '@/lib/historico';
import { AVISO_SEM_ACESSO_PEDIDO, ehPedidoDeNota, ocultarEventosDoPedido } from '@/lib/pedido-nota';
import type { Prioridade } from '@/lib/demandas';
import { temNivel, usaAssistente } from '@/lib/permissoes';
import { resumirPedido } from '@/lib/resumo-pedido';
import type { UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ConversaAssistente } from '../../assistente/conversa-assistente';
import { alterarStatus, assumir, concluir, concluirAtendimento, devolverAoAgente, notaInterna, responder, transferir } from '../acoes';
import { Realce } from '../realce';
import { AcoesConversa, BotaoPainel, type DemandaDaConversa as AcoesDaDemanda } from './acoes-conversa';
import { situacaoDasMensagens } from '../../treinar-agente/ensinar';
import { AbaAgente } from './aba-agente';
import { AbaCliente } from './aba-cliente';
import { AbrirDemanda } from './abrir-demanda';
import { DemandaDaConversa } from './demanda-da-conversa';
import type { DemandaDetalhe } from './tipos-conversa';
import { Compositor } from './compositor';
import { EnsinarAgente } from './ensinar-agente';
import { AvisoAssistente, EstadoConversa } from './estado-conversa';
import { FaixaPassagem } from './faixa-passagem';
import { CartaoDecisaoConversa, MarcoConversa, PorQue } from './itens-historico';
import { MarcarLida } from './marcar-lida';
import { TrocarEmpresa } from './trocar-empresa';
import { GradeConversa, PainelLateral } from './painel-lateral';
import { COOKIE_PAINEL_CONVERSA, painelAbertoDoCookie, rotuloDasAbas } from './preferencias-conversa';

const AUTOR: Record<string, AutorMensagem> = { cliente: 'cliente', agente: 'agente', atendente: 'atendente', sistema: 'sistema' };

type ItemHistorico =
  | { id: string; criado_em: string; tipo: 'mensagem'; autor: AutorMensagem; nome: string | null; propria: boolean; conteudo: string | null; transcricao: string | null; arquivo: { nome: string; href: string } | null; falhou: boolean; porQue: DecisaoBruta[] | null }
  | { id: string; criado_em: string; tipo: 'nota'; nome: string | null; propria: boolean; conteudo: string | null; demanda: number | null }
  | { id: string; criado_em: string; tipo: 'cartao'; cartao: CartaoDecisao }
  | { id: string; criado_em: string; tipo: 'marco'; texto: string };

export type Empresa = { id: string; nome: string };

/**
 * Centro (cabeçalho, histórico, compositor) e painel da direita da conversa aberta. Fica num Suspense na página:
 * enquanto carrega aparece o esqueleto no formato da conversa; a lista ao lado não pisca.
 */
export async function ConversaAberta({ id, u, filtroNaUrl, q, erro, pessoas, pausaGeral, dataAlvo = null }: {
  id: string;
  u: UsuarioPainel;
  filtroNaUrl: string | null;
  q: string;
  erro?: string;
  pessoas: { id: string; nome: string; ativo: boolean }[];
  pausaGeral: boolean | null;
  /** Dia pedido em ?data= (o "abrir" de Gastos com IA): o histórico abre rolado até ele, realçado. */
  dataAlvo?: string | null;
}) {
  const sb = await supabaseServidor();
  const { data: conversa } = await sb.from('conversas')
    .select('*, contatos(id, nome, agente_pausado), clientes:cliente_em_foco(id, razao_social, nome_fantasia, cnpj, agente_pausado, ativo)')
    .eq('id', id).maybeSingle();
  if (!conversa) notFound();
  const [{ data: mensagens }, { data: chamados }, { data: notas }, { data: decisoes }, { data: setores }, { data: respostas }, { data: vinculos }, { data: eventosConversa }, { data: todasDemandas }, { data: transferencias }] = await Promise.all([
    sb.from('mensagens').select('*, usuarios(nome)').eq('conversa_id', id).order('criado_em'),
    sb.from('chamados').select('*, setores(nome), usuarios(nome), chamado_eventos(tipo, texto, criado_em, usuarios(nome))')
      .eq('conversa_id', id).neq('status', 'concluido').order('numero').order('criado_em', { referencedTable: 'chamado_eventos' }),
    // Notas internas de todas as demandas da conversa (também as já concluídas) entram no histórico.
    sb.from('chamado_eventos').select('id, texto, criado_em, usuario_id, usuarios(nome), chamados!inner(numero, conversa_id, titulo, pedido_venda)')
      .eq('chamados.conversa_id', id).eq('tipo', 'nota_interna'),
    sb.from('decisoes_agente').select('id, etapa, entrada, saida, justificativa, criado_em, turno').eq('conversa_id', id).order('criado_em', { ascending: false }).limit(300),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('respostas_prontas').select('id, pergunta, resposta').eq('ativo', true).order('pergunta'),
    // Empresas ativas pelas quais o contato fala (a troca da empresa da conversa só vale entre elas).
    conversa.contatos
      ? sb.from('contato_clientes').select('clientes!inner(id, razao_social, nome_fantasia, ativo)').eq('contato_id', conversa.contatos.id).eq('clientes.ativo', true)
      : Promise.resolve({ data: [] as { clientes: { id: string; razao_social: string; nome_fantasia: string | null; ativo: boolean } | null }[] }),
    sb.from('conversa_eventos').select('id, tipo, texto, criado_em, usuarios(nome)').eq('conversa_id', id).order('criado_em'),
    sb.from('chamados').select('id, numero, prioridade, criado_em, concluido_em, setores(nome)').eq('conversa_id', id),
    sb.from('chamado_eventos').select('id, criado_em, texto, chamados!inner(numero, conversa_id)').eq('chamados.conversa_id', id).eq('tipo', 'transferencia'),
  ]);
  const minha = conversa.atendente_id === u.id;
  const nomeDe = new Map(pessoas.map((p) => [p.id, p.nome]));
  const abertas = chamados ?? [];
  // "Pedidos de nota: Sem acesso" (P11): pedido, descrição, notas e textos livres da demanda de pedido ficam no servidor.
  const verPedidos = temNivel(u, 'notas', 'ver');
  const oculto = (c: { titulo: string | null; pedido_venda: unknown } | null | undefined) => !verPedidos && Boolean(c) && ehPedidoDeNota(c!);
  // Sem acesso a pedidos, o conteúdo do pedido sai das decisões ANTES de virar "por quê?", cartão ou aba AGENTE (P11).
  const decisoesTela = ocultarPedidoDasDecisoes((decisoes ?? []).map((d) => ({ ...d, justificativa: d.justificativa ?? null })), verPedidos);
  const porQue = porQueDasMensagens(mensagens ?? [], decisoesTela);
  const marcos = marcosDaConversa({
    eventos: (eventosConversa ?? []).map((e) => ({ id: e.id, tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario: e.usuarios?.nome ?? null })),
    demandas: (todasDemandas ?? []).map((c) => ({ id: c.id, numero: c.numero, setor: c.setores?.nome ?? null, prioridade: c.prioridade, criado_em: c.criado_em, concluido_em: c.concluido_em })),
    transferencias: (transferencias ?? []).map((t) => ({ id: t.id, numero: t.chamados.numero, setor: t.texto, criado_em: t.criado_em })),
  });
  const turnoDoBotao = turnoDaPassagem(decisoesTela, mensagens ?? [], conversa.aguardando_pessoa_desde);
  const ultimaMensagemEm = (mensagens ?? []).at(-1)?.criado_em ?? null;

  // Cadastro da unidade compradora dos pedidos de nota (o mesmo que o CSV do Bling usa).
  const unidades = [...new Set(abertas.filter((c) => !oculto(c)).flatMap((c) => {
    const uid = (c.pedido_venda as PedidoVendaSalvo | null)?.unidade_id;
    return uid ? [uid] : [];
  }))];
  const { data: compradores } = unidades.length
    ? await sb.from('parceiros_unidades').select('id, razao_social, nome_unidade, cnpj, endereco, numero, complemento, bairro, cidade, uf, cep, telefone').in('id', unidades)
    : { data: [] };

  // Link do documento que a IA mandou: só se for da empresa da conversa (ou de outra empresa ativa do contato) e a pessoa puder abri-lo (RLS).
  const idsDocumentos = [...new Set((mensagens ?? []).flatMap((m) => (m.documento_id ? [m.documento_id] : [])))];
  const { data: documentosVisiveis } = idsDocumentos.length
    ? await sb.from('documentos_empresa').select('id, cliente_id').in('id', idsDocumentos)
    : { data: [] as { id: string; cliente_id: string }[] };
  const documentosAbertos = documentosAbertosDe(documentosVisiveis ?? [], conversa.cliente_em_foco, (vinculos ?? []).map((v) => v.clientes?.id));

  // Aba CLIENTE: tudo da empresa em foco (sem empresa, listas vazias). A RLS já limita as demandas ao nível de Demandas da pessoa.
  const empresaId = conversa.cliente_em_foco;
  const lerAbaCliente = async () => {
    if (!empresaId) return { ficha: null, marcas: null, demandasEmpresa: [], pedidosEmpresa: [], documentos: [] };
    const [{ data: ficha }, { data: marcas }, { data: demandasEmpresa }, { data: pedidosEmpresa }, { data: documentos }] = await Promise.all([
      sb.from('clientes').select('id, razao_social, nome_fantasia, cnpj, regime, cliente_servicos(servicos(nome))').eq('id', empresaId).maybeSingle(),
      conversa.contato_id
        ? sb.from('contato_clientes').select('pode_pedir_nota, pode_atualizar_preco').eq('contato_id', conversa.contato_id).eq('cliente_id', empresaId).maybeSingle()
        : Promise.resolve({ data: null }),
      sb.from('chamados').select('id, numero, titulo, prioridade, prazo_em, prazo_pausado_desde')
        .eq('cliente_id', empresaId).neq('status', 'concluido').order('prazo_em', { ascending: true, nullsFirst: false }).limit(20),
      // Sem acesso a pedidos de nota (P11), a consulta nem sai do servidor.
      verPedidos
        ? sb.from('chamados').select('id, criado_em, pedido_venda').eq('cliente_id', empresaId).not('pedido_venda', 'is', null).order('criado_em', { ascending: false }).limit(5)
        : Promise.resolve({ data: [] as { id: string; criado_em: string; pedido_venda: unknown }[] }),
      sb.from('documentos_empresa').select('id, nome').eq('cliente_id', empresaId).eq('ia_pode_enviar', true).order('nome'),
    ]);
    return { ficha, marcas, demandasEmpresa: demandasEmpresa ?? [], pedidosEmpresa: pedidosEmpresa ?? [], documentos: documentos ?? [] };
  };
  const { ficha, marcas, demandasEmpresa, pedidosEmpresa, documentos } = await lerAbaCliente();

  const podeAssistente = usaAssistente(u);
  const podeCsv = temNivel(u, 'notas', 'corrigir');
  const podeTreinar = temNivel(u, 'treinar', 'sim');
  const loja = await cookies();

  const nomeContato = conversa.contatos?.nome ?? mascararTelefone(conversa.telefone);
  const empresa = conversa.clientes
    ? { id: conversa.clientes.id, nome: conversa.clientes.nome_fantasia ?? conversa.clientes.razao_social, cnpj: conversa.clientes.cnpj }
    : null;
  const outrasEmpresas: Empresa[] = (vinculos ?? []).flatMap((v) => (v.clientes && v.clientes.id !== empresa?.id
    ? [{ id: v.clientes.id, nome: v.clientes.nome_fantasia ?? v.clientes.razao_social }]
    : []));
  const estado = estadoDaConversa({
    assumidaPor: conversa.estado === 'humano' ? (minha ? 'você' : (conversa.atendente_id && nomeDe.get(conversa.atendente_id)) || 'equipe') : null,
    pausaGeral,
    empresaPausada: conversa.clientes?.agente_pausado,
    contatoPausado: conversa.contatos?.agente_pausado,
  });

  const itens: ItemHistorico[] = [
    ...(mensagens ?? []).map((m): ItemHistorico => ({
      id: m.id, criado_em: m.criado_em, tipo: 'mensagem', autor: AUTOR[m.autor] ?? 'sistema',
      nome: m.autor === 'atendente' ? m.usuarios?.nome ?? null : null, propria: m.atendente_id === u.id,
      // Documento que a IA mandou: o nome vira link (download auditado em /api/documentos); sem acesso, fica o texto.
      conteudo: m.documento_id && documentosAbertos.has(m.documento_id) ? null : m.conteudo, transcricao: m.transcricao,
      arquivo: m.documento_id
        ? documentosAbertos.has(m.documento_id)
          ? { nome: (m.conteudo ?? 'Documento').replace(/^📎\s*/u, ''), href: `/api/documentos?id=${m.documento_id}` }
          : null
        : m.arquivo_path ? { nome: m.arquivo_nome ?? 'Abrir anexo', href: `/api/arquivos?path=${encodeURIComponent(m.arquivo_path)}` } : null,
      falhou: m.status_envio === 'falhou', porQue: porQue.get(m.id) ?? null,
    })),
    ...cartoesDeDecisao(decisoesTela).map((c): ItemHistorico => ({ id: c.id, criado_em: c.criado_em, tipo: 'cartao', cartao: c })),
    ...marcos.map((x): ItemHistorico => ({ id: x.id, criado_em: x.criado_em, tipo: 'marco', texto: x.texto })),
    ...(notas ?? []).map((n): ItemHistorico => ({
      id: n.id, criado_em: n.criado_em, tipo: 'nota', nome: n.usuarios?.nome ?? null, propria: n.usuario_id === u.id, conteudo: oculto(n.chamados) ? AVISO_SEM_ACESSO_PEDIDO : n.texto, demanda: n.chamados?.numero ?? null,
    })),
  ];
  const historico = linhaDoTempo(itens);

  const demandasAcoes: AcoesDaDemanda[] = abertas.map((c) => ({
    id: c.id, numero: c.numero, titulo: c.titulo, setorId: c.setor_id, status: c.status as StatusDemanda,
    transferir: transferir.bind(null, c.id, id),
    aguardandoCliente: alterarStatus.bind(null, c.id, id, 'aguardando_cliente'),
    concluir: concluir.bind(null, c.id, id),
    nota: notaInterna.bind(null, c.id, id),
  }));
  const demandasDetalhe: DemandaDetalhe[] = abertas.map((c) => {
    const eventos = c.chamado_eventos.map((e) => ({ tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario: e.usuarios?.nome ?? null }));
    const semPedido = oculto(c);
    return {
      id: c.id, numero: c.numero, titulo: c.titulo, resumo: semPedido ? AVISO_SEM_ACESSO_PEDIDO : c.resumo, status: c.status as StatusDemanda,
      setor: c.setores?.nome ?? null, responsavel: c.usuarios?.nome ?? null, fora_do_contrato: c.fora_do_contrato,
      criado_em: c.criado_em, pedido_venda: semPedido ? null : c.pedido_venda,
      eventos: semPedido ? ocultarEventosDoPedido(eventos) : eventos,
    };
  });

  const compradoresPorId = new Map((compradores ?? []).map((c) => [c.id, c as CompradorCadastrado]));
  const pedidosRecentes = verPedidos
    ? (pedidosEmpresa ?? []).flatMap((p) => { const r = resumirPedido(p.pedido_venda, null); return r ? [{ id: p.id, criado_em: p.criado_em, destino: r.destinatario.nome, total: r.total }] : []; })
    : null;
  const detalheDaConversa = new Map(demandasDetalhe.map((d) => {
    const acoes = demandasAcoes.find((a) => a.id === d.id)!;
    const salvo = d.pedido_venda as PedidoVendaSalvo | null;
    return [d.id, <DemandaDaConversa key={d.id} d={d} acoes={acoes} comprador={salvo?.unidade_id ? compradoresPorId.get(salvo.unidade_id) ?? null : null} podeCsv={podeCsv} />];
  }));
  // Demandas desta conversa que não são da empresa em foco (ex.: Triagem sem empresa) entram na lista também.
  const daEmpresa = new Set((demandasEmpresa ?? []).map((d) => d.id));
  const demandasDaAba = [
    ...(demandasEmpresa ?? []).map((d) => ({ id: d.id, numero: d.numero, titulo: d.titulo, prioridade: d.prioridade as Prioridade,
      prazo_em: d.prazo_em, prazo_pausado_desde: d.prazo_pausado_desde })),
    ...abertas.filter((d) => !daEmpresa.has(d.id)).map((d) => ({ id: d.id, numero: d.numero, titulo: d.titulo, prioridade: d.prioridade as Prioridade,
      prazo_em: d.prazo_em, prazo_pausado_desde: d.prazo_pausado_desde })),
  ];

  return (
    <EstadoConversa
      painelInicial={Boolean(erro) || painelAbertoDoCookie(loja.get(COOKIE_PAINEL_CONVERSA)?.value)}
      abaInicial={erro && podeAssistente ? 'assistente' : 'cliente'}
      demandaInicial={abertas[0]?.id ?? null}
      aviso={erro}
    >
      <GradeConversa
        painel={(
          <PainelLateral
            cliente={(
              <AbaCliente
                conversaId={id}
                empresa={ficha ? { id: ficha.id, nome: ficha.nome_fantasia ?? ficha.razao_social, cnpj: ficha.cnpj, regime: ficha.regime,
                  servicos: ficha.cliente_servicos.flatMap((cs) => (cs.servicos ? [cs.servicos.nome] : [])) } : null}
                contato={conversa.contatos}
                podeEditarContato={temNivel(u, 'clientes', 'editar')}
                marcas={marcas ? { podePedirNota: marcas.pode_pedir_nota, podeMudarPreco: marcas.pode_atualizar_preco } : null}
                demandas={demandasDaAba}
                detalheDaConversa={detalheDaConversa}
                pedidos={pedidosRecentes}
                documentos={documentos ?? []}
                agora={new Date()}
              />
            )}
            assistente={podeAssistente ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <p className="text-xs text-muted">Já sabe deste cliente e das demandas desta conversa.</p>
                <AvisoAssistente />
                <ConversaAssistente usuarioId={u.id} conversaId={id} podeCsv={podeCsv} compacta />
              </div>
            ) : undefined}
            agente={<AbaAgente decisoes={decisoesTela} passagem={conversa.aguardando_pessoa_desde ? { desde: conversa.aguardando_pessoa_desde, motivo: conversa.motivo_pessoa } : null} />}
          />
        )}
      >
        <header className="flex flex-col gap-2 border-b border-border bg-surface px-4 py-3 lg:col-start-1 lg:row-start-1">
          <div className="flex items-start gap-2">
            <Link
              href={`/atendimento${consultaCaixa({ filtro: filtroNaUrl, q })}`}
              aria-label="Voltar para a lista"
              className="-ml-1 mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-muted hover:text-foreground xl:hidden"
            >
              <ArrowLeft aria-hidden size={16} strokeWidth={1.75} />
            </Link>
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-sm font-bold text-brand">{iniciais(nomeContato)}</span>
            <div className="min-w-0 flex-1">
              <h1 id="titulo-conversa" className="truncate text-lg font-bold text-foreground">
                {nomeContato}{' '}
                {conversa.contatos && <span className="tabular text-sm font-normal text-muted">{mascararTelefone(conversa.telefone)}</span>}
              </h1>
              <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
                <span className="truncate font-semibold text-brand">{empresa?.nome ?? 'Empresa não definida'}</span>
                {outrasEmpresas.length > 0 && <><span aria-hidden className="text-subtle">·</span><TrocarEmpresa conversaId={id} outras={outrasEmpresas} /></>}
              </p>
            </div>
            <AgentStateIndicator estado={estado} className="mt-0.5" />
            <BotaoPainel rotuloAbas={rotuloDasAbas(podeAssistente)} />
          </div>
          <AcoesConversa
            minha={minha}
            assumir={assumir.bind(null, id)}
            devolver={devolverAoAgente.bind(null, id)}
            concluirAtendimento={concluirAtendimento.bind(null, id)}
            demandas={demandasAcoes}
            setores={setores ?? []}
            pessoas={pessoas.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }))}
          >
            {podeTreinar && (
              <EnsinarAgente
                situacao={situacaoDasMensagens((mensagens ?? []).filter((m) => m.autor === 'cliente').map((m) => m.conteudo || m.transcricao))}
                empresa={empresa ? { id: empresa.id, nome: empresa.nome, ativa: conversa.clientes?.ativo ?? false } : null}
              />
            )}
          </AcoesConversa>
        </header>

        <MarcarLida conversaId={id} ate={ultimaMensagemEm} />
        <HistoricoRolante
          ultima={historico.at(-1)?.chave ?? ''}
          compositor="[data-compositor]"
          rotulo="Histórico da conversa"
          role="log"
          inicial={dataAlvo ? `dia-${dataAlvo}` : undefined}
          className="min-h-0 flex-1 lg:col-start-1 lg:row-start-2"
          classNameLista="h-full"
        >
          {conversa.aguardando_pessoa_desde && (
            <div className="sticky top-0 z-10">
              <FaixaPassagem desde={conversa.aguardando_pessoa_desde} motivo={conversa.motivo_pessoa} turno={turnoDoBotao} />
            </div>
          )}
          <div className="p-4">
            <Realce chave={`historico-${id}`} lembrar={false} className="flex flex-col gap-2">
              {historico.length === 0 && <p className="py-10 text-center text-sm text-muted">Nenhuma mensagem nesta conversa ainda.</p>}
              {historico.map((h) => {
                if (h.tipo === 'dia') {
                  const alvo = dataAlvo !== null && h.iso === dataAlvo;
                  const rotulo = alvo ? `${h.rotulo} · Atendimento deste dia` : h.rotulo;
                  return (
                    <div
                      key={h.chave}
                      id={h.iso ? `dia-${h.iso}` : undefined}
                      data-dia-alvo={alvo ? 'true' : undefined}
                      role="separator"
                      aria-label={rotulo}
                      className={cn('my-2 flex scroll-mt-14 items-center gap-3 text-xs font-medium text-subtle', alvo && 'rounded-md bg-brand-soft px-2 py-1 font-semibold text-brand')}
                    >
                      <span className="h-px flex-1 bg-border" />
                      {rotulo}
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  );
                }
                const m = h.item;
                if (m.tipo === 'marco') return <div key={h.chave} className="flex"><MarcoConversa texto={m.texto} criadoEm={m.criado_em} /></div>;
                if (m.tipo === 'cartao') return <div key={h.chave} className="flex"><CartaoDecisaoConversa cartao={m.cartao} /></div>;
                return (
                  <div key={h.chave} data-realce={m.criado_em} data-realce-proprio={m.propria ? '' : undefined} className="flex flex-col rounded-lg">
                    {m.tipo === 'nota' ? (
                      <MessageBubble autor="nota_interna" hora={m.criado_em} conteudo={m.conteudo}>
                        {(m.nome || m.demanda) && (
                          <p className="text-xs text-internal-note-foreground">
                            {m.nome ?? 'Equipe'}{m.demanda ? ` · demanda #${m.demanda}` : ''}
                          </p>
                        )}
                      </MessageBubble>
                    ) : (
                      <MessageBubble
                        autor={m.autor}
                        nome={m.nome}
                        hora={m.criado_em}
                        conteudo={m.conteudo}
                        transcricao={m.transcricao}
                        arquivo={m.arquivo}
                        falhou={m.falhou}
                      >
                        {m.porQue && <PorQue decisoes={m.porQue} />}
                      </MessageBubble>
                    )}
                  </div>
                );
              })}
            </Realce>
          </div>
        </HistoricoRolante>

        <div className="lg:col-start-1 lg:row-start-3">
          <Compositor
            responder={responder.bind(null, id)} demandas={demandasAcoes} respostas={respostas ?? []}
            conversaId={id} podeSugerir={usaAssistente(u, 'site')}
            abrirDemanda={(
              // key fixa: o elemento passa pelo Compositor (client) e a atualização ao vivo não pode remontar a janela já aberta.
              <AbrirDemanda key="abrir-demanda" conversaId={id} desligado={empresa || outrasEmpresas.length ? null : 'Cadastre o contato e a empresa antes de abrir uma demanda.'} />
            )}
          />
        </div>
      </GradeConversa>
    </EstadoConversa>
  );
}
