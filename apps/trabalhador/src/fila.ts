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
  await boss.createQueue(FILAS.enviarMensagem, { name: FILAS.enviarMensagem, retryLimit: 5, retryDelay: 10, retryBackoff: true });
  await boss.createQueue(FILAS.removerArquivos, { name: FILAS.removerArquivos, retryLimit: 10, retryDelay: 60, retryBackoff: true });
  for (const nome of [FILAS.verificarEnviadaPorMim, FILAS.batimento, FILAS.alertaFila, FILAS.resumoDiario, FILAS.limpezaRetencao]) {
    await boss.createQueue(nome, { name: nome, retryLimit: 2 });
  }
  return boss;
}

export function filaDe(boss: PgBoss): Fila {
  return {
    async enviar(nome, dados, opcoes) {
      await boss.send(nome, dados, opcoes ?? {});
    },
  };
}
