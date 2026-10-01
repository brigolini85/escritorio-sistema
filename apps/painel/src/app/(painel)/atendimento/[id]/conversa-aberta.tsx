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
import { consultaCaixa } from '@/lib/caixa';
import { mascararTelefone } from '@/lib/formatos';
import { linhaDoTempo } from '@/lib/historico';
import { temPermissao, type UsuarioPainel } from '@/lib/sessao';
import { supabaseServidor } from '@/lib/supabase/servidor';
import { ConversaAssistente } from '../../assistente/conversa-assistente';
import { alterarStatus, assumir, concluir, devolverAoAgente, notaInterna, responder, transferir } from '../acoes';
import { Realce } from '../realce';
import { AcoesConversa, BotaoPainel, type DemandaDaConversa } from './acoes-conversa';
import { situacaoDasMensagens } from '../../treinar-agente/ensinar';
import { Compositor } from './compositor';
import { EnsinarAgente } from './ensinar-agente';
import { DetalhesConversa, type DemandaDetalhe } from './detalhes-conversa';
import { AvisoAssistente, EstadoConversa } from './estado-conversa';
import { GradeConversa, PainelLateral } from './painel-lateral';
import { COOKIE_PAINEL_CONVERSA, painelAbertoDoCookie } from './preferencias-conversa';

const AUTOR: Record<string, AutorMensagem> = { cliente: 'cliente', agente: 'agente', atendente: 'atendente', sistema: 'sistema' };

type ItemHistorico =
  | { id: string; criado_em: string; tipo: 'mensagem'; autor: AutorMensagem; nome: string | null; propria: boolean; conteudo: string | null; transcricao: string | null; arquivo: { nome: string; href: string } | null; falhou: boolean }
  | { id: string; criado_em: string; tipo: 'nota'; nome: string | null; propria: boolean; conteudo: string | null; demanda: number | null };

export type Empresa = { id: string; nome: string };

/**
 * Centro (cabeçalho, histórico, compositor) e painel da direita da conversa aberta. Fica num Suspense na página:
 * enquanto carrega aparece o esqueleto no formato da conversa; a lista ao lado não pisca.
 */
export async function ConversaAberta({ id, u, filtroNaUrl, q, erro, pessoas, pausaGeral }: {
  id: string;
  u: UsuarioPainel;
  filtroNaUrl: string | null;
  q: string;
  erro?: string;
  pessoas: { id: string; nome: string; ativo: boolean }[];
  pausaGeral: boolean | null;
}) {
  const sb = await supabaseServidor();
  const { data: conversa } = await sb.from('conversas')
    .select('*, contatos(id, nome, agente_pausado), clientes:cliente_em_foco(id, razao_social, nome_fantasia, cnpj, agente_pausado, ativo)')
    .eq('id', id).maybeSingle();
  if (!conversa) notFound();
  const [{ data: mensagens }, { data: chamados }, { data: notas }, { data: decisoes }, { data: setores }, { data: respostas }, { data: vinculos }] = await Promise.all([
    sb.from('mensagens').select('*, usuarios(nome)').eq('conversa_id', id).order('criado_em'),
    sb.from('chamados').select('*, setores(nome), usuarios(nome), chamado_eventos(tipo, texto, criado_em, usuarios(nome))')
      .eq('conversa_id', id).neq('status', 'concluido').order('numero').order('criado_em', { referencedTable: 'chamado_eventos' }),
    // Notas internas de todas as demandas da conversa (também as já concluídas) entram no histórico.
    sb.from('chamado_eventos').select('id, texto, criado_em, usuario_id, usuarios(nome), chamados!inner(numero, conversa_id)')
      .eq('chamados.conversa_id', id).eq('tipo', 'nota_interna'),
    sb.from('decisoes_agente').select('etapa, entrada, saida, justificativa, criado_em').eq('conversa_id', id).order('criado_em', { ascending: false }).limit(30),
    sb.from('setores').select('id, nome').eq('ativo', true).order('nome'),
    sb.from('respostas_prontas').select('id, pergunta, resposta').eq('ativo', true).order('pergunta'),
    // Outras empresas pelas quais o contato fala (só leitura; trocar a empresa da conversa ainda não existe).
    conversa.contatos
      ? sb.from('contato_clientes').select('clientes(id, razao_social, nome_fantasia)').eq('contato_id', conversa.contatos.id)
      : Promise.resolve({ data: [] as { clientes: { id: string; razao_social: string; nome_fantasia: string | null } | null }[] }),
  ]);
  const minha = conversa.atendente_id === u.id;
  const nomeDe = new Map(pessoas.map((p) => [p.id, p.nome]));
  const abertas = chamados ?? [];

  // Cadastro da unidade compradora dos pedidos de nota (o mesmo que o CSV do Bling usa).
  const unidades = [...new Set(abertas.flatMap((c) => {
    const uid = (c.pedido_venda as PedidoVendaSalvo | null)?.unidade_id;
    return uid ? [uid] : [];
  }))];
  const { data: compradores } = unidades.length
    ? await sb.from('parceiros_unidades').select('id, razao_social, nome_unidade, cnpj, endereco, numero, complemento, bairro, cidade, uf, cep, telefone').in('id', unidades)
    : { data: [] };

  const podeAssistente = u.permissoes.includes('assistente_site');
  const podeCsv = temPermissao(u, 'emitir_notas');
  const podeTreinar = temPermissao(u, 'treinar_agente');
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
      conteudo: m.conteudo, transcricao: m.transcricao,
      arquivo: m.arquivo_path ? { nome: m.arquivo_nome ?? 'Abrir anexo', href: `/api/arquivos?path=${encodeURIComponent(m.arquivo_path)}` } : null,
      falhou: m.status_envio === 'falhou',
    })),
    ...(notas ?? []).map((n): ItemHistorico => ({
      id: n.id, criado_em: n.criado_em, tipo: 'nota', nome: n.usuarios?.nome ?? null, propria: n.usuario_id === u.id, conteudo: n.texto, demanda: n.chamados?.numero ?? null,
    })),
  ];
  const historico = linhaDoTempo(itens);

  const demandasAcoes: DemandaDaConversa[] = abertas.map((c) => ({
    id: c.id, numero: c.numero, titulo: c.titulo, setorId: c.setor_id, status: c.status as StatusDemanda,
    transferir: transferir.bind(null, c.id, id),
    aguardandoCliente: alterarStatus.bind(null, c.id, id, 'aguardando_cliente'),
    concluir: concluir.bind(null, c.id, id),
    nota: notaInterna.bind(null, c.id, id),
  }));
  const demandasDetalhe: DemandaDetalhe[] = abertas.map((c) => ({
    id: c.id, numero: c.numero, titulo: c.titulo, resumo: c.resumo, status: c.status as StatusDemanda,
    setor: c.setores?.nome ?? null, responsavel: c.usuarios?.nome ?? null, fora_do_contrato: c.fora_do_contrato,
    criado_em: c.criado_em, pedido_venda: c.pedido_venda,
    eventos: c.chamado_eventos.map((e) => ({ tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario: e.usuarios?.nome ?? null })),
  }));

  return (
    <EstadoConversa
      painelInicial={Boolean(erro) || painelAbertoDoCookie(loja.get(COOKIE_PAINEL_CONVERSA)?.value)}
      abaInicial={podeAssistente ? 'assistente' : 'detalhes'}
      demandaInicial={abertas[0]?.id ?? null}
      aviso={erro}
    >
      <GradeConversa
        painel={(
          <PainelLateral
            assistente={podeAssistente ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <p className="text-xs text-muted">Já sabe deste cliente e das demandas desta conversa.</p>
                <AvisoAssistente />
                <ConversaAssistente usuarioId={u.id} conversaId={id} podeCsv={podeCsv} compacta />
              </div>
            ) : undefined}
            detalhes={(
              <DetalhesConversa
                conversaId={id}
                empresa={empresa}
                outrasEmpresas={outrasEmpresas}
                contato={conversa.contatos}
                podeEditarContato={temPermissao(u, 'editar_clientes')}
                demandas={demandasDetalhe}
                compradores={new Map((compradores ?? []).map((c) => [c.id, c as CompradorCadastrado]))}
                podeCsv={podeCsv}
                decisoes={(decisoes ?? []).map((d) => ({ ...d, justificativa: d.justificativa ?? null }))}
              />
            )}
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
            <div className="min-w-0 flex-1">
              <h1 id="titulo-conversa" className="truncate text-lg font-semibold text-foreground">{nomeContato}</h1>
              <p className="truncate text-sm text-muted">
                {empresa?.nome ?? 'Empresa não definida'}
                {conversa.contatos && (
                  <>
                    <span aria-hidden> · </span>
                    <span className="tabular">{mascararTelefone(conversa.telefone)}</span>
                  </>
                )}
              </p>
              {outrasEmpresas.length > 0 && (
                <p className="truncate text-xs text-subtle">
                  Também fala por:{' '}
                  {outrasEmpresas.map((e, i) => (
                    <span key={e.id}>
                      {i > 0 && ', '}
                      <Link href={`/clientes/${e.id}`} className="text-brand underline-offset-4 hover:underline">{e.nome}</Link>
                    </span>
                  ))}
                </p>
              )}
            </div>
            <AgentStateIndicator estado={estado} className="mt-0.5" />
            <BotaoPainel />
          </div>
          <AcoesConversa
            minha={minha}
            assumir={assumir.bind(null, id)}
            devolver={devolverAoAgente.bind(null, id)}
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

        <HistoricoRolante
          ultima={historico.at(-1)?.chave ?? ''}
          compositor="[data-compositor]"
          rotulo="Histórico da conversa"
          role="log"
          className="min-h-0 flex-1 lg:col-start-1 lg:row-start-2"
          classNameLista="h-full"
        >
          <div className="p-4">
            <Realce chave={`historico-${id}`} lembrar={false} className="flex flex-col gap-2">
              {historico.length === 0 && <p className="py-10 text-center text-sm text-muted">Nenhuma mensagem nesta conversa ainda.</p>}
              {historico.map((h) => {
                if (h.tipo === 'dia') {
                  return (
                    <div key={h.chave} role="separator" aria-label={h.rotulo} className="my-2 flex items-center gap-3 text-xs font-medium text-subtle">
                      <span className="h-px flex-1 bg-border" />
                      {h.rotulo}
                      <span className="h-px flex-1 bg-border" />
                    </div>
                  );
                }
                const m = h.item;
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
                      />
                    )}
                  </div>
                );
              })}
            </Realce>
          </div>
        </HistoricoRolante>

        <div className="lg:col-start-1 lg:row-start-3">
          <Compositor responder={responder.bind(null, id)} demandas={demandasAcoes} respostas={respostas ?? []} />
        </div>
      </GradeConversa>
    </EstadoConversa>
  );
}
