import { ROTULO_ESTADO_TAREFA, TEXTO_MOTIVO_PAUSA, podeAprovarTarefa, type EstadoTarefa, type EtapaTarefa, type MotivoPausa, type ResultadoTarefa, type TipoPendencia } from '@escritorio/core';

/** Parte I3a: o que a tela da tarefa mostra (lido com a sessão da pessoa; a RLS decide). */
export type PendenciaTela = {
  id: string; numero: number; tipo: TipoPendencia; pergunta: string; detalhe: string | null; opcoes: string[]; mensagem: string | null;
  estado: 'aberta' | 'respondida'; resposta: string | null; respondidaPor: string | null; respondidaEm: string | null;
  contato: string | null; pedidoTexto: string | null; pedidoEm: string | null; pedidoEnviadoEm: string | null; pedidos: number;
};
export type ArquivoTela = { id: string; nome: string; tamanho: number; origem: 'enviado' | 'conversa'; lido: boolean; detalhe: string | null };
export type EventoTarefaTela = { quem: 'agente' | 'pessoa' | 'sistema'; nome: string; texto: string; criadoEm: string };
export type TarefaTela = {
  id: string; numero: number; estado: EstadoTarefa; motivoPausa: MotivoPausa | null; agente: string; setorId: string | null; setor: string | null;
  demanda: { id: string; numero: number; titulo: string }; empresa: { id: string; nome: string; cnpj: string } | null;
  pedido: string; pedidaPor: string | null; canal: 'painel' | 'whatsapp' | 'automatico'; criadoEm: string;
  etapas: EtapaTarefa[]; etapaAtual: number; resultado: ResultadoTarefa | null; ajustePendente: boolean;
  custoUsd: number; custoEtapas: Record<string, number>; limiteUsd: number; limiteMinutos: number; segundosTrabalhando: number;
  pendencias: PendenciaTela[]; arquivos: ArquivoTela[]; eventos: EventoTarefaTela[]; decididaPor: string | null; decididaEm: string | null;
};
/** O bloco da demanda (D21). */
export type ResumoTarefaDemanda = {
  id: string; estado: EstadoTarefa; motivoPausa: MotivoPausa | null; agente: string; etapa: string | null; abertas: number; custoUsd: number;
};
export type AgenteDeTrabalho = { id: string; nome: string; estado: 'teste' | 'ligado'; podePedir: boolean; procedimentos: { nome: string; titulo: string; descricao: string }[] };

export const pendenciasAbertas = (t: Pick<TarefaTela, 'pendencias'>): number => t.pendencias.filter((p) => p.estado === 'aberta').length;
export const podeAprovar = (t: Pick<TarefaTela, 'estado' | 'pendencias'>): boolean => podeAprovarTarefa(t.estado, pendenciasAbertas(t));
export function textoDoEstado(t: Pick<TarefaTela, 'estado' | 'motivoPausa'>): string {
  return t.estado === 'pausada' && t.motivoPausa ? TEXTO_MOTIVO_PAUSA[t.motivoPausa] : ROTULO_ESTADO_TAREFA[t.estado];
}

/** F19: o único texto para tarefa em setor desativado (as Tasks 13 e 14 usam este). */
export const TEXTO_SETOR_INATIVO = 'O setor desta demanda está desativado: não dá para pedir nem mexer em tarefas dele.';

const DIA_MS = 24 * 3600_000;
/** D7: em que pé está o pedido ao cliente. "Enviando" = aprovado e ainda sem a mensagem mandada. */
export function situacaoPedido(p: PendenciaTela): 'a_pedir' | 'enviando' | 'aguardando' | 'recebida' {
  if (p.estado === 'respondida') return 'recebida';
  if (!p.pedidoEm) return 'a_pedir';
  return p.pedidoEnviadoEm ? 'aguardando' : 'enviando';
}
/** A mesma regra do banco (pedir_pendencia_ao_cliente): 24 h depois do último pedido e no máximo 5. */
export function podeCobrarDeNovo(p: PendenciaTela, agora: Date): boolean {
  return p.estado === 'aberta' && !!p.pedidoEm && p.pedidos < 5 && agora.getTime() - new Date(p.pedidoEm).getTime() >= DIA_MS;
}
/** D12: custo de cada etapa, na ordem da barra. */
export function custoPorEtapa(t: Pick<TarefaTela, 'etapas' | 'custoEtapas'>): { nome: string; custo: number }[] {
  return t.etapas.map((e, i) => ({ nome: e.nome, custo: Number(t.custoEtapas[String(i + 1)] ?? 0) })).filter((x) => x.custo > 0);
}
export function rotuloQuem(e: EventoTarefaTela, agente: string): string {
  if (e.quem === 'agente') return agente;
  if (e.quem === 'sistema') return 'Sistema';
  return e.nome || 'Alguém da equipe';
}
export const nomeDoCsv = (t: Pick<TarefaTela, 'numero' | 'estado'>): string => `tarefa-${t.numero}-${t.estado === 'aprovada' ? 'aprovada' : 'rascunho'}.csv`;
