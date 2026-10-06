import 'server-only';
import { ehResultadoTarefa, tarefaAtiva, type EstadoTarefa, type EtapaTarefa, type MotivoPausa, type TipoPendencia } from '@escritorio/core';
import { rotuloDoAgente } from '@/lib/agente-demanda';
import { semMigracaoI1 } from '@/lib/agentes';
import { lerDriveDaTarefa } from '@/lib/drive';
import { ehPedidoDeNota } from '@/lib/pedido-nota';
import type { supabaseServidor } from '@/lib/supabase/servidor';
import { ehMotivoSegurado, type AgenteDeTrabalho, type MotivoSegurado, type PedidoDaTarefa, type ResumoTarefaDemanda, type TarefaTela } from './tarefas-tela';

type Sb = Awaited<ReturnType<typeof supabaseServidor>>;
const COLUNAS = `id, numero, estado, motivo_pausa, setor_id, chamado_id, pedido, canal, criado_em, etapas, etapa_atual, resultado, ajuste_pendente,
  custo_usd, custo_etapas, limite_usd, limite_minutos, segundos_trabalhando, decidida_em, agentes(nome), setores(nome, ativo), chamados(numero, titulo, pedido_venda),
  clientes(id, razao_social, nome_fantasia, cnpj), pedidor:usuarios!agente_tarefas_pedida_por_fkey(nome), decisor:usuarios!agente_tarefas_decidida_por_fkey(nome)`;
type Linha = {
  id: string; numero: number; estado: EstadoTarefa; motivo_pausa: MotivoPausa | null; setor_id: string | null; chamado_id: string; pedido: string;
  canal: TarefaTela['canal']; criado_em: string; etapas: EtapaTarefa[]; etapa_atual: number; resultado: unknown; ajuste_pendente: boolean;
  custo_usd: number; custo_etapas: Record<string, number>; limite_usd: number; limite_minutos: number; segundos_trabalhando: number; decidida_em: string | null;
  agentes: { nome: string } | null; setores: { nome: string; ativo?: boolean } | null; chamados: { numero: number; titulo: string; pedido_venda?: unknown } | null;
  clientes: { id: string; razao_social: string; nome_fantasia: string | null; cnpj: string } | null; pedidor: { nome: string } | null; decisor: { nome: string } | null;
};

/** I3b: a linha do arquivo pede removido_em; banco sem a I3b refaz sem a coluna. */
async function lerArquivosDaTarefa(sb: Sb, id: string) {
  const r = await sb.from('agente_tarefa_arquivos').select('id, nome, tamanho, origem, lido_em, detalhe, removido_em').eq('tarefa_id', id).order('criado_em');
  if (!semMigracaoI1(r.error)) return r;
  return sb.from('agente_tarefa_arquivos').select('id, nome, tamanho, origem, lido_em, detalhe').eq('tarefa_id', id).order('criado_em');
}

/** Parte I3a: a tarefa inteira para a página (D21). `semI3`: o banco ainda não tem a Parte I3 (a página mostra a faixa). */
export async function lerTarefa(sb: Sb, id: string): Promise<{ tarefa: TarefaTela | null; semI3: boolean }> {
  const { data, error } = await sb.from('agente_tarefas').select(COLUNAS).eq('id', id).maybeSingle();
  if (semMigracaoI1(error)) return { tarefa: null, semI3: true };
  if (error) console.error('[tarefas] leitura', error);
  if (!data) return { tarefa: null, semI3: false };
  const t = data as unknown as Linha;
  const [pend, arq, ev, seg, drive] = await Promise.all([
    sb.from('agente_pendencias').select(`id, numero, tipo, pergunta, detalhe, opcoes, mensagem, estado, resposta, respondida_em, pedido_texto, pedido_em,
      pedido_enviado_em, mensagem_id, pedidos, respondedor:usuarios!agente_pendencias_respondida_por_fkey(nome), contatos(nome)`).eq('tarefa_id', id).order('numero'),
    lerArquivosDaTarefa(sb, id),
    sb.from('agente_tarefa_eventos').select('quem, texto, criado_em, usuarios(nome)').eq('tarefa_id', id).order('criado_em'),
    // Revisão final: por que um pedido aprovado ainda não saiu (conversa com uma pessoa, pausa, limite do dia, contato sem procura).
    sb.rpc('pedidos_segurados_da_tarefa', { p_tarefa: id }),
    lerDriveDaTarefa(sb, t.clientes?.id ?? null),
  ]);
  for (const e of [pend.error, arq.error, ev.error, seg.error]) if (e) console.error('[tarefas] leitura', e);
  const segurados = new Map<string, MotivoSegurado>();
  for (const x of (seg.data ?? []) as { pendencia_id: string; motivo: string }[]) if (ehMotivoSegurado(x.motivo)) segurados.set(x.pendencia_id, x.motivo);
  return {
    semI3: false,
    tarefa: {
      id: t.id, numero: Number(t.numero), estado: t.estado, motivoPausa: t.motivo_pausa, setorId: t.setor_id, setor: t.setores?.nome ?? null, ...(t.setores?.ativo === false ? { setorAtivo: false } : {}),
      // A RLS de agentes esconde o nome de quem não é dono/administrador: o rótulo vem do setor (como na I2).
      agente: t.agentes?.nome ?? rotuloDoAgente(t.setores?.nome),
      demanda: { id: t.chamado_id, numero: Number(t.chamados?.numero ?? 0), titulo: t.chamados?.titulo ?? '', pedidoDeNota: ehPedidoDeNota({ titulo: t.chamados?.titulo ?? null, pedido_venda: t.chamados?.pedido_venda }) },
      empresa: t.clientes ? { id: t.clientes.id, nome: t.clientes.nome_fantasia ?? t.clientes.razao_social, cnpj: t.clientes.cnpj } : null,
      pedido: t.pedido, pedidaPor: t.pedidor?.nome ?? null, canal: t.canal, criadoEm: t.criado_em, etapas: t.etapas ?? [], etapaAtual: t.etapa_atual,
      resultado: ehResultadoTarefa(t.resultado) ? t.resultado : null, ajustePendente: t.ajuste_pendente, custoUsd: Number(t.custo_usd),
      custoEtapas: t.custo_etapas ?? {}, limiteUsd: Number(t.limite_usd), limiteMinutos: t.limite_minutos, segundosTrabalhando: t.segundos_trabalhando,
      decididaPor: t.decisor?.nome ?? null, decididaEm: t.decidida_em,
      pendencias: ((pend.data ?? []) as unknown as {
        id: string; numero: number; tipo: TipoPendencia; pergunta: string; detalhe: string | null; opcoes: string[] | null; mensagem: string | null;
        estado: 'aberta' | 'respondida'; resposta: string | null; respondida_em: string | null; pedido_texto: string | null; pedido_em: string | null;
        pedido_enviado_em: string | null; mensagem_id: string | null; pedidos: number; respondedor: { nome: string } | null; contatos: { nome: string } | null;
      }[]).map((p) => ({
        id: p.id, numero: p.numero, tipo: p.tipo, pergunta: p.pergunta, detalhe: p.detalhe, opcoes: p.opcoes ?? [], mensagem: p.mensagem, estado: p.estado,
        resposta: p.resposta, respondidaPor: p.respondedor?.nome ?? null, respondidaEm: p.respondida_em, contato: p.contatos?.nome ?? null,
        // Enviado = com a mensagem marcada; a reserva do trabalhador sozinha não é envio (revisão final).
        pedidoTexto: p.pedido_texto, pedidoEm: p.pedido_em, pedidoEnviadoEm: p.mensagem_id ? p.pedido_enviado_em : null, pedidos: p.pedidos,
        segurado: segurados.get(p.id) ?? null,
      })),
      arquivos: ((arq.data ?? []) as { id: string; nome: string; tamanho: number; origem: 'enviado' | 'conversa' | 'drive'; lido_em: string | null; detalhe: string | null; removido_em?: string | null }[])
        .map((a) => ({ id: a.id, nome: a.nome, tamanho: a.tamanho, origem: a.origem, lido: a.lido_em !== null, detalhe: a.detalhe, removido: a.removido_em != null })),
      drive,
      eventos: ((ev.data ?? []) as unknown as { quem: 'agente' | 'pessoa' | 'sistema'; texto: string; criado_em: string; usuarios: { nome: string } | null }[])
        .map((e) => ({ quem: e.quem, nome: e.usuarios?.nome ?? '', texto: e.texto, criadoEm: e.criado_em })),
    },
  };
}

/** D21: a tarefa da demanda (a ativa; sem ela, a mais nova) para o bloco do painel lateral. */
export async function lerTarefaDaDemanda(sb: Sb, chamadoId: string, setor: string | null): Promise<{ tarefa: ResumoTarefaDemanda | null; semI3: boolean }> {
  const { data, error } = await sb.from('agente_tarefas').select('id, estado, motivo_pausa, etapas, etapa_atual, custo_usd, agentes(nome)')
    .eq('chamado_id', chamadoId).order('criado_em', { ascending: false }).limit(5);
  if (semMigracaoI1(error)) return { tarefa: null, semI3: true };
  if (error) console.error('[tarefas] da demanda', error);
  const linhas = (data ?? []) as unknown as { id: string; estado: EstadoTarefa; motivo_pausa: MotivoPausa | null; etapas: EtapaTarefa[]; etapa_atual: number;
    custo_usd: number; agentes: { nome: string } | null }[];
  const t = linhas.find((l) => tarefaAtiva(l.estado)) ?? linhas[0];
  if (!t) return { tarefa: null, semI3: false };
  // GET comum (não head): o fallback sem a I3 depende do código real do erro.
  const { data: abertas, error: erroAbertas } = await sb.from('agente_pendencias').select('id').eq('tarefa_id', t.id).eq('estado', 'aberta');
  if (erroAbertas) console.error('[tarefas] pendências da demanda', erroAbertas);
  return {
    semI3: false,
    tarefa: { id: t.id, estado: t.estado, motivoPausa: t.motivo_pausa, agente: t.agentes?.nome ?? rotuloDoAgente(setor),
      etapa: t.etapas?.[t.etapa_atual - 1]?.nome ?? null, abertas: (abertas ?? []).length, custoUsd: Number(t.custo_usd) },
  };
}

/** D3: agentes de trabalho do setor da demanda (a RLS de agentes não deixa a pessoa do setor ler). null = banco sem a I3. */
export async function lerAgentesDeTrabalho(sb: Sb, chamadoId: string): Promise<AgenteDeTrabalho[] | null> {
  const { data, error } = await sb.rpc('agentes_de_trabalho_da_demanda', { p_chamado: chamadoId });
  if (semMigracaoI1(error)) return null;
  if (error) console.error('[tarefas] agentes de trabalho', error);
  return ((data ?? []) as { id: string; nome: string; estado: 'teste' | 'ligado'; pode_pedir: boolean; procedimentos: unknown }[]).map((a) => ({
    id: a.id, nome: a.nome, estado: a.estado, podePedir: a.pode_pedir,
    procedimentos: Array.isArray(a.procedimentos) ? (a.procedimentos as AgenteDeTrabalho['procedimentos']) : [],
  }));
}

export async function lerContatosParaPendencia(sb: Sb, pendenciaId: string): Promise<{ id: string; nome: string; emAtendimento: boolean }[]> {
  const { data, error } = await sb.rpc('contatos_para_pendencia', { p_id: pendenciaId });
  if (error) console.error('[tarefas] contatos da pendência', error);
  return ((data ?? []) as { contato_id: string; nome: string; em_atendimento?: boolean }[])
    .map((c) => ({ id: c.contato_id, nome: c.nome, emAtendimento: c.em_atendimento === true }));
}

export async function lerArquivosDaConversa(sb: Sb, pendenciaId: string): Promise<{ mensagemId: string; nome: string; criadoEm: string }[]> {
  const { data, error } = await sb.rpc('arquivos_da_conversa_para_pendencia', { p_id: pendenciaId });
  if (error) console.error('[tarefas] arquivos da conversa', error);
  return ((data ?? []) as { mensagem_id: string; nome: string; criado_em: string }[]).map((a) => ({ mensagemId: a.mensagem_id, nome: a.nome, criadoEm: a.criado_em }));
}

/** I4: o pedido como saiu da janela (prazo, avisos, Drive) e se veio pelo Assistente. Banco sem a I4 = null (a tela da I3 segue igual). */
export async function lerPedidoDaTarefa(sb: Sb, id: string): Promise<PedidoDaTarefa | null> {
  const [t, ev] = await Promise.all([
    sb.from('agente_tarefas').select('prazo_desejado, avisar_painel, avisar_whatsapp, drive_subpasta, ler_drive').eq('id', id).maybeSingle(),
    sb.from('agente_tarefa_eventos').select('texto').eq('tarefa_id', id).order('criado_em').limit(1).maybeSingle(),
  ]);
  if (t.error) { if (!semMigracaoI1(t.error)) console.error('[tarefas] pedido', t.error); return null; }
  if (!t.data) return null;
  const d = t.data as unknown as { prazo_desejado: string | null; avisar_painel: boolean; avisar_whatsapp: boolean; drive_subpasta: string | null; ler_drive: boolean };
  return { prazoDesejado: d.prazo_desejado, avisarPainel: d.avisar_painel, avisarWhatsapp: d.avisar_whatsapp, subpasta: d.drive_subpasta, lerDrive: d.ler_drive,
    pediuPeloAssistente: (ev.data as { texto: string } | null)?.texto === 'pediu a tarefa pelo Assistente' };
}
