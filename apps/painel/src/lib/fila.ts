import 'server-only';
import PgBoss from 'pg-boss';

let boss: Promise<PgBoss> | null = null;

/**
 * Auditoria 4.14: o painel só publica jobs; 3 conexões bastam e deixam folga no limite do Session pooler (o trabalhador
 * usa 6). Ver docs/operacao.md, "Conexões com o banco".
 */
export const MAXIMO_CONEXOES_FILA = 3;

/** Mesma configuração do trabalhador (apps/trabalhador/src/fila.ts). Criadas aqui só quando o painel usa a DATABASE_URL. */
const FILAS: { nome: string; opcoes: PgBoss.Queue }[] = [
  { nome: 'enviar-mensagem', opcoes: { name: 'enviar-mensagem', retryLimit: 5, retryDelay: 10, retryBackoff: true } },
  { nome: 'remover-arquivos', opcoes: { name: 'remover-arquivos', retryLimit: 10, retryDelay: 60, retryBackoff: true } },
  // FILAS.assistente, revisão geral I1: "short"; a vez é a trava do banco (naVez).
  { nome: 'assistente', opcoes: { name: 'assistente', policy: 'short', retryLimit: 3, retryDelay: 20, retryBackoff: true } },
  { nome: 'simular_agente', opcoes: { name: 'simular_agente', policy: 'stately', retryLimit: 2, retryDelay: 15, retryBackoff: true } },
  { nome: 'sugerir_resposta', opcoes: { name: 'sugerir_resposta', policy: 'stately', retryLimit: 1, retryDelay: 5 } },
  // FILAS.agenteTrabalho e FILAS.pendenciaCliente.
  { nome: 'agente_trabalho', opcoes: { name: 'agente_trabalho', policy: 'stately', retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 1800 } },
  { nome: 'pendencia_cliente', opcoes: { name: 'pendencia_cliente', policy: 'stately', retryLimit: 3, retryDelay: 30, retryBackoff: true } },
  // FILAS.pastaDrive.
  { nome: 'pasta_drive', opcoes: { name: 'pasta_drive', policy: 'stately', retryLimit: 1, retryDelay: 30 } },
];

function obterBoss(): Promise<PgBoss> {
  boss ??= (async () => {
    // Auditoria 2.9: com DATABASE_URL_FILA, o papel painel_fila (só enfileira; não lê o resto do banco). Sem ela, a
    // DATABASE_URL do dono do banco, como antes (a partida avisa no log: instrumentation.ts).
    const urlFila = process.env.DATABASE_URL_FILA?.trim();
    const restrito = Boolean(urlFila);
    // Só publica jobs: manutenção e agendamentos ficam com o trabalhador. O papel restrito não migra o esquema.
    const b = new PgBoss({
      connectionString: urlFila || process.env.DATABASE_URL!, supervise: false, schedule: false, migrate: !restrito, max: MAXIMO_CONEXOES_FILA,
    });
    b.on('error', (e) => console.error('[fila painel]', e));
    await b.start();
    if (!restrito) {
      // Idempotente: garante as filas mesmo se o painel subir antes do trabalhador.
      for (const f of FILAS) await b.createQueue(f.nome, f.opcoes);
    } else {
      // O papel restrito não cria fila (é DDL). Sem a fila, o send não grava nada: o log diz qual falta.
      const faltam: string[] = [];
      for (const f of FILAS) if (!(await b.getQueue(f.nome))) faltam.push(f.nome);
      if (faltam.length) console.error(`[fila painel] filas ainda não criadas pelo trabalhador: ${faltam.join(', ')}. Ligue o trabalhador.`);
    }
    return b;
  })().catch((e: unknown) => {
    // Falhou ao conectar: esquece a tentativa para a próxima chamada tentar de novo, em vez de repetir o erro para sempre.
    boss = null;
    throw e;
  });
  return boss;
}

/** Fecha a conexão da fila (testes; o painel em produção fica com ela aberta). */
export async function fecharFila(): Promise<void> {
  const b = boss;
  boss = null;
  if (b) await (await b.catch(() => null))?.stop({ graceful: false });
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
