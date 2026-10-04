import 'server-only';
import { agruparConversasAssistente, LIMITE_CONVERSAS_HISTORICO, LIMITE_MENSAGENS_HISTORICO } from '@/lib/conversas-assistente';
import { mascararTelefone } from '@/lib/formatos';
import type { DemandaDoPedido, EventoPedido } from '@/lib/pedido-assistente';
import { ehPedidoDeNota, ocultarEventosDoPedido } from '@/lib/pedido-nota';
import type { MensagemTela } from '@/lib/resultados-assistente';
import type { supabaseServidor } from '@/lib/supabase/servidor';

/**
 * Leituras da tela do Assistente (Parte G4). Só tabelas e visões que já estão no banco de todos (Partes C–E):
 * assistente_mensagens, conversas, demandas_lista e chamado_eventos (D18). Tudo com o RLS de quem consulta.
 */
type Sb = Awaited<ReturnType<typeof supabaseServidor>>;

export const LIMITE_MENSAGENS_TELA = 60;

export async function lerMensagensAssistente(sb: Sb, usuarioId: string, conversaId: string | null): Promise<MensagemTela[]> {
  let q = sb.from('assistente_mensagens').select('id, papel, conteudo, arquivo, processada_em, criado_em').eq('usuario_id', usuarioId).eq('canal', 'site');
  q = conversaId ? q.eq('conversa_id', conversaId) : q.is('conversa_id', null);
  const { data, error } = await q.order('criado_em', { ascending: false }).limit(LIMITE_MENSAGENS_TELA);
  if (error) console.error('[assistente] mensagens', error);
  return ((data ?? []) as MensagemTela[]).reverse();
}

export type ConversaDoHistorico = { id: string; nome: string; empresa: string | null; ultimaEm: string | null; mensagens: number };

/** Histórico em botões (D14): a "Geral" e as conversas feitas dentro de atendimentos que a pessoa ainda vê. */
export async function lerHistoricoAssistente(sb: Sb, usuarioId: string, conversaId: string | null) {
  const [{ data: ultimaGeral }, { data: doHistorico }] = await Promise.all([
    sb.from('assistente_mensagens').select('criado_em').eq('usuario_id', usuarioId).eq('canal', 'site').is('conversa_id', null)
      .order('criado_em', { ascending: false }).limit(1).maybeSingle(),
    sb.from('assistente_mensagens').select('conversa_id, criado_em').eq('usuario_id', usuarioId).eq('canal', 'site').not('conversa_id', 'is', null)
      .order('criado_em', { ascending: false }).limit(LIMITE_MENSAGENS_HISTORICO),
  ]);
  // Lê o dobro das conversas mostradas: as que o RLS esconde saem antes do limite.
  const lidas = agruparConversasAssistente(doHistorico ?? [], LIMITE_CONVERSAS_HISTORICO * 2);
  const ids = [...new Set([...lidas.map((g) => g.conversaId), ...(conversaId ? [conversaId] : [])])];
  const { data: conversas } = ids.length
    ? await sb.from('conversas').select('id, telefone, contatos(nome), clientes:cliente_em_foco(razao_social, nome_fantasia)').in('id', ids)
    : { data: [] };
  const visiveis = new Map((conversas ?? []).map((c) => [c.id, {
    nome: c.contatos?.nome ?? mascararTelefone(c.telefone),
    empresa: c.clientes ? c.clientes.nome_fantasia ?? c.clientes.razao_social : null,
  }]));
  const lista: ConversaDoHistorico[] = lidas.flatMap((g) => {
    const v = visiveis.get(g.conversaId);
    return v ? [{ id: g.conversaId, nome: v.nome, empresa: v.empresa, ultimaEm: g.ultimaEm, mensagens: g.mensagens }] : [];
  }).slice(0, LIMITE_CONVERSAS_HISTORICO);
  const v = conversaId ? visiveis.get(conversaId) : undefined;
  const aberta: ConversaDoHistorico | null = conversaId && v
    ? lista.find((c) => c.id === conversaId) ?? { id: conversaId, nome: v.nome, empresa: v.empresa, ultimaEm: null, mensagens: 0 }
    : null;
  return { ultimaGeral: (ultimaGeral?.criado_em as string | undefined) ?? null, conversas: lista, aberta };
}

export type LeituraDemanda = { estado: 'ok'; demanda: DemandaDoPedido; eventos: EventoPedido[] } | { estado: 'fora' } | { estado: 'falha' };

/**
 * Demanda do pedido pelo número (D17): demandas_lista com a regra de leitura de quem consulta. Nunca lê o pedido em si
 * (D2). Sem acesso a pedidos de nota, os textos livres dos eventos saem antes de chegar à tela (P11).
 */
export async function lerDemandaDoPedido(sb: Sb, numero: number, verPedidos: boolean): Promise<LeituraDemanda> {
  const { data: d, error } = await sb.from('demandas_lista')
    .select('id, numero, titulo, setor, empresa, status, origem, contato, criado_em, criado_por_nome, tem_pedido').eq('numero', numero).maybeSingle();
  if (error) {
    console.error('[assistente] demanda do pedido', error);
    return { estado: 'falha' };
  }
  if (!d?.id) return { estado: 'fora' };
  const { data: ev, error: erroEventos } = await sb.from('chamado_eventos')
    .select('tipo, texto, criado_em, usuario_id, usuarios(nome)').eq('chamado_id', d.id).order('criado_em');
  if (erroEventos) console.error('[assistente] eventos do pedido', erroEventos);
  const eventos: EventoPedido[] = (ev ?? []).map((e) => ({ tipo: e.tipo, texto: e.texto, criado_em: e.criado_em, usuario_id: e.usuario_id, usuario: e.usuarios?.nome ?? null }));
  const semPedido = !verPedidos && ehPedidoDeNota({ titulo: d.titulo, pedido_venda: d.tem_pedido ? true : null });
  return {
    estado: 'ok',
    demanda: {
      id: d.id, numero: Number(d.numero), titulo: d.titulo ?? '', setor: d.setor, empresa: d.empresa, status: String(d.status ?? ''),
      origem: d.origem ?? 'agente', contato: d.contato, criadoEm: d.criado_em ?? '', criadoPorNome: d.criado_por_nome,
    },
    eventos: semPedido ? ocultarEventosDoPedido(eventos) : eventos,
  };
}
