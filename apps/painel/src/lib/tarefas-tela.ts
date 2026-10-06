import { ROTULO_ESTADO_TAREFA, TEXTO_MOTIVO_PAUSA, podeAprovarTarefa, type EstadoTarefa, type EtapaTarefa, type MotivoPausa, type ResultadoTarefa, type TipoPendencia } from '@escritorio/core';
import { formatarDataHora } from '@/lib/formatos';
import type { DriveDaTarefa } from './drive-tela';

/** Parte I3a: o que a tela da tarefa mostra (lido com a sessão da pessoa; a RLS decide). */
export type PendenciaTela = {
  id: string; numero: number; tipo: TipoPendencia; pergunta: string; detalhe: string | null; opcoes: string[]; mensagem: string | null;
  estado: 'aberta' | 'respondida'; resposta: string | null; respondidaPor: string | null; respondidaEm: string | null;
  contato: string | null; pedidoTexto: string | null; pedidoEm: string | null; pedidoEnviadoEm: string | null; pedidos: number;
  /** Revisão final: por que o pedido aprovado ainda não saiu (pedidos_segurados_da_tarefa). */
  segurado?: MotivoSegurado | null;
};
export type MotivoSegurado = 'atendimento_humano' | 'pausado' | 'limite_dia' | 'nao_procuravel';
const TEXTO_SEGURADO: Record<MotivoSegurado, string> = {
  atendimento_humano: 'Aguardando a conversa voltar para o Thiago',
  pausado: 'Aguardando o atendimento automático voltar (está pausado)',
  limite_dia: 'Aguardando: o limite de pedidos do dia foi atingido',
  nao_procuravel: 'Não pode ser enviado: o contato não pode mais ser procurado por este setor',
};
export const ehMotivoSegurado = (m: unknown): m is MotivoSegurado => typeof m === 'string' && m in TEXTO_SEGURADO;
export type ArquivoTela = { id: string; nome: string; tamanho: number; origem: 'enviado' | 'conversa' | 'drive'; lido: boolean; detalhe: string | null; removido?: boolean };
export type EventoTarefaTela = { quem: 'agente' | 'pessoa' | 'sistema'; nome: string; texto: string; criadoEm: string };
export type TarefaTela = {
  id: string; numero: number; estado: EstadoTarefa; motivoPausa: MotivoPausa | null; agente: string; setorId: string | null; setor: string | null; /** F19: false só quando o setor está desativado. */ setorAtivo?: boolean;
  demanda: { id: string; numero: number; titulo: string }; empresa: { id: string; nome: string; cnpj: string } | null;
  pedido: string; pedidaPor: string | null; canal: 'painel' | 'whatsapp' | 'automatico'; criadoEm: string;
  etapas: EtapaTarefa[]; etapaAtual: number; resultado: ResultadoTarefa | null; ajustePendente: boolean;
  custoUsd: number; custoEtapas: Record<string, number>; limiteUsd: number; limiteMinutos: number; segundosTrabalhando: number;
  pendencias: PendenciaTela[]; arquivos: ArquivoTela[]; eventos: EventoTarefaTela[]; decididaPor: string | null; decididaEm: string | null;
  /** I3b: null = banco sem a I3b; erro = não consegui ler a pasta ou a situação. */ drive?: DriveDaTarefa | null;
};
/** O bloco da demanda (D21). */
export type ResumoTarefaDemanda = {
  id: string; estado: EstadoTarefa; motivoPausa: MotivoPausa | null; agente: string; etapa: string | null; abertas: number; custoUsd: number;
};
export type AgenteDeTrabalho = { id: string; nome: string; estado: 'teste' | 'ligado'; podePedir: boolean; procedimentos: { nome: string; titulo: string; descricao: string }[] };

/** D3: o botão só aparece quando algum agente do setor aceita o pedido desta pessoa (em Teste, só o dono e o administrador). */
export const algumPodePedir = (agentes: Pick<AgenteDeTrabalho, 'podePedir'>[]): boolean => agentes.some((a) => a.podePedir);
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
export const nomeDaPlanilha = (t: Pick<TarefaTela, 'numero' | 'estado'>): string => `tarefa-${t.numero}-${t.estado === 'aprovada' ? 'aprovada' : 'rascunho'}.xlsx`;
/** D15b: a Aprovação avisa; quem decide é a pessoa. */
export const textoProvisorias = (n: number): string | null =>
  (n <= 0 ? null : `${n} linha${n > 1 ? 's provisórias' : ' provisória'}: confira antes de aprovar ou peça ajuste.`);
export const ROTULO_ORIGEM: Record<ArquivoTela['origem'], string> = { enviado: 'Enviado', conversa: 'Da conversa', drive: 'Drive · só leitura' };
/** Task 4: pedido aprovado que o Thiago não mandou em 24 h aparece como "não enviado" (e pode ser cobrado de novo). */
export function situacaoPedidoNaTela(p: PendenciaTela, agora: Date): ReturnType<typeof situacaoPedido> | 'nao_enviado' {
  const s = situacaoPedido(p);
  return s === 'enviando' && p.pedidoEm && agora.getTime() - new Date(p.pedidoEm).getTime() >= DIA_MS ? 'nao_enviado' : s;
}
/** Fix Task 13: só diz "pedido ao contato" quando o Thiago mandou de verdade (pedidoEnviadoEm); senão, o pé do pedido. */
export function textoDoPedido(p: PendenciaTela, agora: Date): string | null {
  const s = situacaoPedidoNaTela(p, agora);
  if (s === 'nao_enviado') return 'Não enviado';
  if (s === 'enviando') return p.segurado ? TEXTO_SEGURADO[p.segurado] : 'Aprovado, aguardando envio';
  if (p.pedidoEnviadoEm) return `Pedido pelo Thiago${p.contato ? ` ao contato ${p.contato}` : ''} em ${formatarDataHora(p.pedidoEnviadoEm)}`;
  return null;
}
/** D7: a janela "Pedir ao cliente" só libera "Mandar pelo Thiago" com contato escolhido e mensagem. */
export const podeMandarPedido = (contatoId: string, texto: string): boolean => contatoId !== '' && texto.trim().length >= 3;

/** I4: o que a pessoa pediu na janela PEDIR AO AGENTE. `null` na leitura = banco sem a I4. */
export type PedidoDaTarefa = { prazoDesejado: string | null; avisarPainel: boolean; avisarWhatsapp: boolean; subpasta: string | null; lerDrive: boolean; pediuPeloAssistente: boolean };
export function textoAvisos(p: PedidoDaTarefa): string {
  if (p.avisarPainel && p.avisarWhatsapp) return 'Avisos: painel e WhatsApp';
  if (p.avisarPainel) return 'Avisos: painel';
  if (p.avisarWhatsapp) return 'Avisos: WhatsApp';
  return 'Sem avisos';
}
/** Prazo desejado em Brasília (dd/MM HH:mm). "atrasado" só vale com a tarefa ativa: quem chama decide. */
export function textoPrazoDesejado(iso: string, agora: Date): { texto: string; atrasado: boolean } {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  const atrasado = new Date(iso).getTime() < agora.getTime();
  return { texto: `Prazo desejado: ${partes.day}/${partes.month} ${partes.hour}:${partes.minute}${atrasado ? ' · passou' : ''}`, atrasado };
}
