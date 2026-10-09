// Auditoria 6.2: pg_dump, pg_restore e psql recebem a conexão por variáveis PG* (a URL e a senha nunca vão na linha de
// comando, que aparece na lista de processos). Sem os programas na máquina, COPIA_PG_DOCKER=<contêiner> usa os de um
// contêiner (ex.: supabase_db_AGENTESDEIA do Supabase local, já na versão 17): só os NOMES das variáveis vão no comando.
import { spawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { ocultar, senhaDaUrl } from './comum';

export function ambientePg(url: string): Record<string, string> {
  const u = new URL(url);
  const env: Record<string, string> = {
    PGHOST: u.hostname,
    PGPORT: u.port || '5432',
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  };
  const ssl = u.searchParams.get('sslmode');
  if (ssl) env.PGSSLMODE = ssl;
  return env;
}

/** Dentro do contêiner do Supabase local, o banco da máquina (127.0.0.1:54322) é o 127.0.0.1:5432 dele. */
function ambienteNoConteiner(env: Record<string, string>): Record<string, string> {
  if (env.PGHOST === '127.0.0.1' || env.PGHOST === 'localhost') return { ...env, PGHOST: '127.0.0.1', PGPORT: '5432' };
  return env;
}

export type Programa = 'pg_dump' | 'pg_restore' | 'psql';

/**
 * Roda um programa do PostgreSQL. `entrada`: o que vai no stdin; o stdout volta para quem chamou (consumir junto com `fim`).
 * O stderr é guardado (sem a senha) para a mensagem de erro.
 */
export function rodarPg(programa: Programa, args: string[], url: string, io: { entrada?: Readable } = {}): {
  stdout: Readable; fim: Promise<void>;
} {
  const conteiner = process.env.COPIA_PG_DOCKER;
  let env = ambientePg(url);
  let comando: string = programa;
  let argumentos = args;
  if (conteiner) {
    env = ambienteNoConteiner(env);
    comando = 'docker';
    argumentos = ['exec', '-i', ...Object.keys(env).flatMap((k) => ['-e', k]), conteiner, programa, ...args];
  }
  const filho = spawn(comando, argumentos, {
    env: { ...process.env, ...env }, stdio: [io.entrada ? 'pipe' : 'ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let erro = '';
  filho.stderr!.on('data', (d: Buffer) => { if (erro.length < 20_000) erro += d.toString(); });
  if (io.entrada && filho.stdin) {
    io.entrada.on('error', (e) => filho.stdin!.destroy(e));
    filho.stdin.on('error', () => undefined);
    io.entrada.pipe(filho.stdin);
  }
  const fim = new Promise<void>((ok, falha) => {
    filho.on('error', (e) => falha(new Error(`${programa} não rodou (${e.message}). Instale o cliente do PostgreSQL 17 ou use COPIA_PG_DOCKER.`)));
    filho.on('close', (codigo) => {
      if (codigo === 0) return ok();
      falha(new Error(`${programa} falhou (código ${codigo}): ${ocultar(erro.trim(), [senhaDaUrl(url)])}`));
    });
  });
  return { stdout: filho.stdout!, fim };
}
