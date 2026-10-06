import { randomUUID } from 'node:crypto';
import type { Repos } from '@escritorio/db';
import PgBoss from 'pg-boss';

export const FILAS = {
  processarConversa: 'processar-conversa',
  verificarEnviadaPorMim: 'verificar-enviada-por-mim',
  enviarMensagem: 'enviar-mensagem',
  batimento: 'batimento',
  alertaFila: 'alerta-fila',
  resumoDiario: 'resumo-diario',
  limpezaRetencao: 'limpeza-retencao',
  removerArquivos: 'remover-arquivos',
  /** Todo dia às 07:00: certificado digital perto de vencer vira demanda no Fiscal (Parte H1). */
  certificados: 'certificados-vencendo',
  assistente: 'assistente',
  /** Treinar o agente: o painel grava a simulação (criar_simulacao) e enfileira { simulacaoId } com este nome. */
  simularAgente: 'simular_agente',
  /** Sugerir resposta (Atendimento): o painel grava o pedido (pedir_sugestao_resposta) e enfileira { sugestaoId }. */
  sugerirResposta: 'sugerir_resposta',
  /** Parte I3a (D6): uma vez de uma tarefa de trabalho; o painel enfileira { tarefaId } com este nome (singletonKey = tarefa). */
  agenteTrabalho: 'agente_trabalho',
  /** Parte I3a (D7): mandar ao cliente o pedido de uma pendência que a pessoa aprovou; { pendenciaId }. */
  pendenciaCliente: 'pendencia_cliente',
  /** Parte I3b (D7): LER A PASTA DE NOVO; o painel enfileira { tarefaId } (singletonKey = tarefa). */
  pastaDrive: 'pasta_drive',
  /** Parte I4 (D9): um aviso de tarefa ao WhatsApp de quem pediu; { avisoId }. */
  avisoTarefa: 'aviso_tarefa',
  /** Parte I5 (D5): a cada minuto, o ciclo do Radar (abre e roda giros). Uma vez de cada vez. */
  radar: 'radar',
  /** Parte I5 (D14): a cada minuto, os envios do Radar que uma pessoa aprovou. */
  radarEnvios: 'radar-envios',
} as const;

export interface Fila {
  enviar(nome: string, dados: object, opcoes?: { startAfter?: number; singletonKey?: string }): Promise<void>;
}

/** Tempo de espera para juntar mensagens picadas antes de responder. */
export const ESPERA_AGRUPAMENTO_SEGUNDOS = 8;

export async function agendarProcessamento(fila: Fila, conversaId: string): Promise<void> {
  await fila.enviar(FILAS.processarConversa, { conversaId }, { singletonKey: conversaId, startAfter: ESPERA_AGRUPAMENTO_SEGUNDOS });
}

/**
 * createQueue não muda uma fila que já existe (o pg-boss ignora): o updateQueue logo depois põe a configuração do código
 * também nas filas criadas antes (homologação e produção). Revisão geral I1/I2.
 */
async function garantirFila(boss: PgBoss, nome: string, opcoes: Omit<PgBoss.Queue, 'name'> = {}): Promise<void> {
  await boss.createQueue(nome, { name: nome, ...opcoes });
  await boss.updateQueue(nome, { name: nome, ...opcoes });
}

/** I2: prazo do job da conversa; a vez para de abrir rodadas bem antes (PRAZO_VEZ_CONVERSA_MS) e a trava vale mais que isto. */
export const EXPIRA_CONVERSA_SEGUNDOS = 900;
/** I1: a trava da conversa (e do assistente) vence depois do prazo do job: um job vencido não roda junto com o que ainda está rodando. */
export const TRAVA_VEZ_SEGUNDOS = 20 * 60;
/** I1: a conversa (ou pergunta) ocupada volta para a fila depois deste tempo. */
export const ESPERA_OCUPADA_SEGUNDOS = 15;

export async function criarBoss(databaseUrl: string): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: databaseUrl });
  boss.on('error', (e) => console.error('[fila]', e));
  await boss.start();
  // Revisão geral I1: "short" = no máximo um job ESPERANDO por chave (mensagens picadas viram um processamento só); a vez
  // por conversa é a trava do banco (naVez). "stately" travava a busca de todos os consumidores no pg-boss 10.4.2.
  await garantirFila(boss, FILAS.processarConversa, {
    policy: 'short', retryLimit: 3, retryDelay: 20, retryBackoff: true, expireInSeconds: EXPIRA_CONVERSA_SEGUNDOS,
  });
  await garantirFila(boss, FILAS.assistente, { policy: 'short', retryLimit: 3, retryDelay: 20, retryBackoff: true });
  // Mesma configuração em apps/painel/src/lib/fila.ts (o painel enfileira os testes). "stately" + singletonKey = id do teste:
  // o mesmo teste enfileirado duas vezes não roda em paralelo (nem paga a IA duas vezes).
  await garantirFila(boss, FILAS.simularAgente, { policy: 'stately', retryLimit: 2, retryDelay: 15, retryBackoff: true });
  // Mesma configuração em apps/painel/src/lib/fila.ts; singletonKey = id da sugestão (o painel enfileira).
  await garantirFila(boss, FILAS.sugerirResposta, { policy: 'stately', retryLimit: 1, retryDelay: 5 });
  // Mesma configuração em apps/painel/src/lib/fila.ts. "stately" + singletonKey = tarefa: uma vez por tarefa (D6); 30 min por vez no máximo
  // (a vez para de abrir rodadas aos 20 min, F6: a expiração fica acima para o job não ser repetido com a vez ainda rodando).
  await garantirFila(boss, FILAS.agenteTrabalho, { policy: 'stately', retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 1800 });
  // Mesma configuração em apps/painel/src/lib/fila.ts; singletonKey = pendência + vez do pedido.
  await garantirFila(boss, FILAS.pendenciaCliente, { policy: 'stately', retryLimit: 3, retryDelay: 30, retryBackoff: true });
  // Mesma configuração em apps/painel/src/lib/fila.ts; singletonKey = tarefa (uma leitura da pasta por vez).
  await garantirFila(boss, FILAS.pastaDrive, { policy: 'stately', retryLimit: 1, retryDelay: 30 });
  // Parte I4 (D9): singletonKey = aviso; a reserva no banco impede o envio duplo.
  await garantirFila(boss, FILAS.avisoTarefa, { retryLimit: 2, retryDelay: 30, retryBackoff: true });
  await garantirFila(boss, FILAS.enviarMensagem, { retryLimit: 5, retryDelay: 10, retryBackoff: true });
  await garantirFila(boss, FILAS.removerArquivos, { retryLimit: 10, retryDelay: 60, retryBackoff: true });
  for (const nome of [FILAS.verificarEnviadaPorMim, FILAS.batimento, FILAS.alertaFila, FILAS.resumoDiario, FILAS.limpezaRetencao, FILAS.certificados]) {
    await garantirFila(boss, nome, { retryLimit: 2 });
  }
  // Parte I5: um ciclo por vez ("stately" sem chave: um esperando e um rodando); o giro pode levar até 40 min (D8).
  await garantirFila(boss, FILAS.radar, { policy: 'stately', retryLimit: 0, expireInSeconds: 3000 });
  await garantirFila(boss, FILAS.radarEnvios, { policy: 'stately', retryLimit: 0, expireInSeconds: 600 });
  return boss;
}

export type JobAssistente = { usuarioId: string; canal: 'site' | 'whatsapp'; conversaId: string | null; telefone: string | null };

/** A mesma chave da fila e da trava (I1): uma vez por usuário, canal e contexto. */
export const chaveAssistente = (j: Pick<JobAssistente, 'usuarioId' | 'canal' | 'conversaId'>) => `${j.usuarioId}:${j.canal}:${j.conversaId ?? '-'}`;

/** Uma execução por usuário, canal e contexto: perguntas seguidas são respondidas juntas. */
export async function agendarAssistente(fila: Fila, j: JobAssistente, startAfter?: number): Promise<void> {
  await fila.enviar(FILAS.assistente, j, { singletonKey: chaveAssistente(j), ...(startAfter ? { startAfter } : {}) });
}

/** Job da fila `simular_agente`: o id da linha em `simulacoes_agente` (status pendente). */
export type JobSimulacao = { simulacaoId: string };

export async function agendarSimulacao(fila: Fila, simulacaoId: string): Promise<void> {
  await fila.enviar(FILAS.simularAgente, { simulacaoId } satisfies JobSimulacao, { singletonKey: simulacaoId });
}

export function filaDe(boss: PgBoss): Fila {
  return {
    async enviar(nome, dados, opcoes) {
      await boss.send(nome, dados, opcoes ?? {});
    },
  };
}

/** Job da fila `sugerir_resposta`: o id da linha em `sugestoes_resposta` (status pendente). */
export type JobSugestao = { sugestaoId: string };

/** Job da fila `agente_trabalho`: a tarefa a trabalhar (o banco diz se ainda está "trabalhando"). */
export type JobTarefa = { tarefaId: string };
export async function agendarTarefa(fila: Fila, tarefaId: string): Promise<void> {
  await fila.enviar(FILAS.agenteTrabalho, { tarefaId } satisfies JobTarefa, { singletonKey: tarefaId });
}
/** Job da fila `pasta_drive` (Parte I3b): a tarefa cuja pasta do cliente a pessoa mandou ler de novo. */
export type JobPastaDrive = { tarefaId: string };
/** Job da fila `pendencia_cliente`: a pendência cujo pedido a pessoa aprovou. */
export type JobPendencia = { pendenciaId: string };
/** vez: o número do pedido (o painel, a cada PEDIR AO CLIENTE / COBRAR DE NOVO) ou 'batimento' (pedido que não saiu, F5). A reserva no banco impede o envio duplo. */
export async function agendarPedidoPendencia(fila: Fila, pendenciaId: string, vez: number | 'batimento'): Promise<void> {
  await fila.enviar(FILAS.pendenciaCliente, { pendenciaId } satisfies JobPendencia, { singletonKey: `${pendenciaId}:${vez}` });
}
/** Job da fila `aviso_tarefa` (Parte I4): o aviso a mandar ao WhatsApp de quem pediu a tarefa. */
export type JobAviso = { avisoId: string };
export async function agendarAviso(fila: Fila, avisoId: string): Promise<void> {
  await fila.enviar(FILAS.avisoTarefa, { avisoId } satisfies JobAviso, { singletonKey: avisoId });
}

/**
 * Revisão geral I1: uma execução por chave (conversa, pergunta do assistente) por uma trava no banco, no lugar da política
 * "stately" (que no pg-boss 10.4.2 travava a fila inteira). Ocupada: `ocupada` (em geral, enfileirar de novo mais tarde).
 */
export async function naVez<T>(
  repos: Pick<Repos, 'pegarTrava' | 'soltarTrava'>, chave: string, segundos: number, fazer: () => Promise<T>, ocupada: () => Promise<void>,
): Promise<T | 'ocupada'> {
  const dono = randomUUID();
  if (!(await repos.pegarTrava(chave, dono, segundos))) {
    await ocupada();
    return 'ocupada';
  }
  try {
    return await fazer();
  } finally {
    // Falha ao soltar: a trava vence sozinha em `segundos`.
    await repos.soltarTrava(chave, dono).catch((e) => console.error('[fila] trava não solta', chave, e));
  }
}
