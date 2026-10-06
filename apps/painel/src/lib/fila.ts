import 'server-only';
import PgBoss from 'pg-boss';

let boss: Promise<PgBoss> | null = null;

function obterBoss(): Promise<PgBoss> {
  boss ??= (async () => {
    // Só publica jobs: manutenção e agendamentos ficam com o trabalhador.
    const b = new PgBoss({ connectionString: process.env.DATABASE_URL!, supervise: false, schedule: false });
    b.on('error', (e) => console.error('[fila painel]', e));
    await b.start();
    // Idempotente: garante as filas mesmo se o painel subir antes do trabalhador. Mesma configuração da Task 9.
    await b.createQueue('enviar-mensagem', { name: 'enviar-mensagem', retryLimit: 5, retryDelay: 10, retryBackoff: true });
    await b.createQueue('remover-arquivos', { name: 'remover-arquivos', retryLimit: 10, retryDelay: 60, retryBackoff: true });
    await b.createQueue('assistente', { name: 'assistente', policy: 'stately', retryLimit: 3, retryDelay: 20, retryBackoff: true });
    // Mesma configuração do trabalhador (apps/trabalhador/src/fila.ts, FILAS.simularAgente).
    await b.createQueue('simular_agente', { name: 'simular_agente', policy: 'stately', retryLimit: 2, retryDelay: 15, retryBackoff: true });
    // Mesma configuração do trabalhador (apps/trabalhador/src/fila.ts, FILAS.sugerirResposta).
    await b.createQueue('sugerir_resposta', { name: 'sugerir_resposta', policy: 'stately', retryLimit: 1, retryDelay: 5 });
    // Mesma configuração do trabalhador (apps/trabalhador/src/fila.ts, FILAS.agenteTrabalho e FILAS.pendenciaCliente).
    await b.createQueue('agente_trabalho', { name: 'agente_trabalho', policy: 'stately', retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 1800 });
    await b.createQueue('pendencia_cliente', { name: 'pendencia_cliente', policy: 'stately', retryLimit: 3, retryDelay: 30, retryBackoff: true });
    // Mesma configuração do trabalhador (FILAS.pastaDrive).
    await b.createQueue('pasta_drive', { name: 'pasta_drive', policy: 'stately', retryLimit: 1, retryDelay: 30 });
    return b;
  })().catch((e: unknown) => {
    // Falhou ao conectar: esquece a tentativa para a próxima chamada tentar de novo, em vez de repetir o erro para sempre.
    boss = null;
    throw e;
  });
  return boss;
}

/** Se falhar, a resposta fica "pendente" e o batimento do trabalhador reenfileira depois de 2 minutos. */
export async function enfileirarEnvio(mensagemId: string): Promise<void> {
  await (await obterBoss()).send('enviar-mensagem', { mensagemId });
}

/** Pergunta ao assistente pelo painel: uma execução por pessoa e contexto (mesma chave do trabalhador). */
export async function enfileirarAssistente(j: { usuarioId: string; conversaId: string | null }): Promise<void> {
  await (await obterBoss()).send('assistente', { usuarioId: j.usuarioId, canal: 'site', conversaId: j.conversaId, telefone: null },
    { singletonKey: `${j.usuarioId}:site:${j.conversaId ?? '-'}` });
}

/** Teste do agente (Treinar o agente). A chave única impede o mesmo teste de rodar duas vezes ao mesmo tempo. */
export async function enfileirarSimulacao(simulacaoId: string): Promise<void> {
  await (await obterBoss()).send('simular_agente', { simulacaoId }, { singletonKey: simulacaoId });
}

/** Sugerir resposta (Atendimento): o pedido já está gravado; a chave única impede rodar duas vezes. */
export async function enfileirarSugestao(sugestaoId: string): Promise<void> {
  await (await obterBoss()).send('sugerir_resposta', { sugestaoId }, { singletonKey: sugestaoId });
}

/** Parte I3a (D6): uma vez da tarefa; a chave única impede duas ao mesmo tempo. */
export async function enfileirarTarefa(tarefaId: string): Promise<void> {
  await (await obterBoss()).send('agente_trabalho', { tarefaId }, { singletonKey: tarefaId });
}
/** Parte I3a (D7): o pedido ao cliente que a pessoa aprovou; a chave leva a vez (cobrar de novo é outro envio). */
export async function enfileirarPedidoPendencia(pendenciaId: string, vez: number): Promise<void> {
  await (await obterBoss()).send('pendencia_cliente', { pendenciaId }, { singletonKey: `${pendenciaId}:${vez}` });
}

/** Parte I3b (D7): LER A PASTA DE NOVO; a chave única impede duas leituras da mesma tarefa ao mesmo tempo. */
export async function enfileirarLeituraPasta(tarefaId: string): Promise<void> {
  await (await obterBoss()).send('pasta_drive', { tarefaId }, { singletonKey: tarefaId });
}

export async function enfileirarRemocaoArquivos(paths: string[]): Promise<void> {
  if (paths.length) await (await obterBoss()).send('remover-arquivos', { paths });
}
