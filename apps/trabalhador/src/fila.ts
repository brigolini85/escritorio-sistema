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
} as const;

export interface Fila {
  enviar(nome: string, dados: object, opcoes?: { startAfter?: number; singletonKey?: string }): Promise<void>;
}

/** Tempo de espera para juntar mensagens picadas antes de responder. */
export const ESPERA_AGRUPAMENTO_SEGUNDOS = 8;

export async function agendarProcessamento(fila: Fila, conversaId: string): Promise<void> {
  await fila.enviar(FILAS.processarConversa, { conversaId }, { singletonKey: conversaId, startAfter: ESPERA_AGRUPAMENTO_SEGUNDOS });
}

export async function criarBoss(databaseUrl: string): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: databaseUrl });
  boss.on('error', (e) => console.error('[fila]', e));
  await boss.start();
  // "stately": no máximo um job por estado e por singletonKey — um aguardando e um em execução por conversa.
  await boss.createQueue(FILAS.processarConversa, { name: FILAS.processarConversa, policy: 'stately', retryLimit: 3, retryDelay: 20, retryBackoff: true });
  await boss.createQueue(FILAS.assistente, { name: FILAS.assistente, policy: 'stately', retryLimit: 3, retryDelay: 20, retryBackoff: true });
  // Mesma configuração em apps/painel/src/lib/fila.ts (o painel enfileira os testes). "stately" + singletonKey = id do teste:
  // o mesmo teste enfileirado duas vezes não roda em paralelo (nem paga a IA duas vezes).
  await boss.createQueue(FILAS.simularAgente, { name: FILAS.simularAgente, policy: 'stately', retryLimit: 2, retryDelay: 15, retryBackoff: true });
  // Mesma configuração em apps/painel/src/lib/fila.ts; singletonKey = id da sugestão (o painel enfileira).
  await boss.createQueue(FILAS.sugerirResposta, { name: FILAS.sugerirResposta, policy: 'stately', retryLimit: 1, retryDelay: 5 });
  // Mesma configuração em apps/painel/src/lib/fila.ts. "stately" + singletonKey = tarefa: uma vez por tarefa (D6); 30 min por vez no máximo
  // (a vez para de abrir rodadas aos 20 min, F6: a expiração fica acima para o job não ser repetido com a vez ainda rodando).
  await boss.createQueue(FILAS.agenteTrabalho, { name: FILAS.agenteTrabalho, policy: 'stately', retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 1800 });
  // Mesma configuração em apps/painel/src/lib/fila.ts; singletonKey = pendência + vez do pedido.
  await boss.createQueue(FILAS.pendenciaCliente, { name: FILAS.pendenciaCliente, policy: 'stately', retryLimit: 3, retryDelay: 30, retryBackoff: true });
  // Mesma configuração em apps/painel/src/lib/fila.ts; singletonKey = tarefa (uma leitura da pasta por vez).
  await boss.createQueue(FILAS.pastaDrive, { name: FILAS.pastaDrive, policy: 'stately', retryLimit: 1, retryDelay: 30 });
  await boss.createQueue(FILAS.enviarMensagem, { name: FILAS.enviarMensagem, retryLimit: 5, retryDelay: 10, retryBackoff: true });
  await boss.createQueue(FILAS.removerArquivos, { name: FILAS.removerArquivos, retryLimit: 10, retryDelay: 60, retryBackoff: true });
  for (const nome of [FILAS.verificarEnviadaPorMim, FILAS.batimento, FILAS.alertaFila, FILAS.resumoDiario, FILAS.limpezaRetencao, FILAS.certificados]) {
    await boss.createQueue(nome, { name: nome, retryLimit: 2 });
  }
  return boss;
}

export type JobAssistente = { usuarioId: string; canal: 'site' | 'whatsapp'; conversaId: string | null; telefone: string | null };

/** Uma execução por usuário, canal e contexto: perguntas seguidas são respondidas juntas. */
export async function agendarAssistente(fila: Fila, j: JobAssistente): Promise<void> {
  await fila.enviar(FILAS.assistente, j, { singletonKey: `${j.usuarioId}:${j.canal}:${j.conversaId ?? '-'}` });
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
