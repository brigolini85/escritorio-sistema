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

export async function enfileirarRemocaoArquivos(paths: string[]): Promise<void> {
  if (paths.length) await (await obterBoss()).send('remover-arquivos', { paths });
}
