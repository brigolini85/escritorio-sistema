// Auditoria 6.2: cópia semanal cifrada do banco e dos arquivos, guardada fora do Supabase (artefato do GitHub).
//   pnpm copia:fazer --saida <arquivo.enc>
// Variáveis: DATABASE_URL (pooler em modo sessão, porta 5432), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, COPIA_CHAVE.
// Conteúdo (um .tar cifrado com AES-256-GCM): banco/public.dump (pg_dump -Fc do esquema public), banco/auth.dump (dados de
// auth.users, auth.identities e auth.mfa_factors), objetos/NNNNNN (cada arquivo dos buckets) e manifesto.json (contagem
// por tabela e lista dos objetos com hash). Tudo sai da mesma foto do banco (snapshot): contagens e dados batem.
// Nunca escreve a chave nem a URL do banco em arquivo ou log; imprime só tamanho e contagens.
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { cifrador, lerChave } from './cifra';
import {
  ARQUIVO_AUTH, ARQUIVO_BANCO, ARQUIVO_MANIFESTO, BUCKETS, argumento, cabecalhosServico, caminhoDoUsuario, hashArquivo, ocultar,
  senhaDaUrl, urlObjeto, type Manifesto,
} from './comum';
import { rodarPg } from './pg';
import { gerarTar } from './tar';

export type OpcoesCopia = {
  databaseUrl: string;
  supabaseUrl: string;
  chaveServico: string;
  /** COPIA_CHAVE (base64). */
  chave: string;
  saida: string;
  /** Só para os testes: copia apenas os objetos cujo nome começa assim. */
  prefixoObjetos?: string;
};

export type ResumoCopia = { bytes: number; tabelas: number; objetos: number; objetosSumidos: number };

async function pgDump(url: string, args: string[], destino: string): Promise<void> {
  const r = rodarPg('pg_dump', args, url);
  await Promise.all([pipeline(r.stdout, createWriteStream(destino)), r.fim]);
}

/** Baixa um objeto em fluxo, calculando o hash. null: o objeto sumiu entre a foto do banco e o download (limpeza, exclusão). */
async function baixarObjeto(o: OpcoesCopia, bucket: string, nome: string, destino: string): Promise<{ sha256: string; bytes: number } | null> {
  const r = await fetch(urlObjeto(o.supabaseUrl, bucket, nome), { headers: cabecalhosServico(o.chaveServico) });
  if (r.status === 404 || r.status === 400) { await r.body?.cancel(); return null; }
  if (!r.ok || !r.body) throw new Error(`Storage respondeu ${r.status} ao baixar um objeto do bucket ${bucket}.`);
  const h = createHash('sha256');
  let bytes = 0;
  const contar = new Transform({ transform(p: Buffer, _c, feito) { h.update(p); bytes += p.length; feito(null, p); } });
  await pipeline(Readable.fromWeb(r.body as never), contar, createWriteStream(destino));
  return { sha256: h.digest('hex'), bytes };
}

export async function fazerCopia(o: OpcoesCopia): Promise<ResumoCopia> {
  const chave = lerChave(o.chave);
  const pasta = await mkdtemp(join(tmpdir(), 'copia-'));
  const cliente = new pg.Client({ connectionString: o.databaseUrl });
  try {
    await mkdir(join(pasta, 'banco'));
    await mkdir(join(pasta, 'objetos'));
    await cliente.connect();
    // A foto: contagens, lista de objetos e os dois pg_dump (--snapshot) veem o mesmo instante do banco.
    await cliente.query('begin isolation level repeatable read read only');
    const criadaEm = new Date().toISOString();
    const [{ snapshot }] = (await cliente.query<{ snapshot: string }>('select pg_export_snapshot() as snapshot')).rows as [{ snapshot: string }];
    const tabelasPublic = (await cliente.query<{ nome: string }>(
      `select 'public.' || c.relname as nome from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition order by 1`)).rows.map((r) => r.nome);
    const tabelas: Record<string, number> = {};
    for (const t of [...tabelasPublic, 'auth.users', 'auth.identities', 'auth.mfa_factors']) {
      const [s, n] = t.split('.') as [string, string];
      const { rows } = await cliente.query<{ n: string }>(`select count(*) as n from ${pg.escapeIdentifier(s)}.${pg.escapeIdentifier(n)}`);
      tabelas[t] = Number(rows[0]!.n);
    }
    const migracao = (await cliente.query<{ v: string | null }>(
      `select case when to_regclass('supabase_migrations.schema_migrations') is null then null
              else (select max(version) from supabase_migrations.schema_migrations) end as v`)).rows[0]!.v;
    const listados = (await cliente.query<{ bucket: string; nome: string; tipo: string | null }>(
      `select bucket_id as bucket, name as nome, metadata->>'mimetype' as tipo from storage.objects
        where bucket_id = any($1) and ($2::text is null or starts_with(name, $2)) order by bucket_id, name`,
      [[...BUCKETS], o.prefixoObjetos ?? null])).rows;

    const snap = `--snapshot=${snapshot}`;
    await pgDump(o.databaseUrl, ['-Fc', '--schema=public', snap], join(pasta, ARQUIVO_BANCO));
    await pgDump(o.databaseUrl, ['-Fc', '--data-only', '--table=auth.users', '--table=auth.identities', '--table=auth.mfa_factors', snap],
      join(pasta, ARQUIVO_AUTH));
    await cliente.query('commit');

    const objetos: Manifesto['objetos'] = [];
    let sumidos = 0;
    for (const obj of listados) {
      const arquivo = `objetos/${String(objetos.length + 1).padStart(6, '0')}`;
      const r = await baixarObjeto(o, obj.bucket, obj.nome, join(pasta, arquivo));
      if (!r) { sumidos++; continue; }
      objetos.push({ bucket: obj.bucket, nome: obj.nome, arquivo, tipo: obj.tipo, ...r });
    }
    const arquivos: Manifesto['arquivos'] = [];
    for (const nome of [ARQUIVO_BANCO, ARQUIVO_AUTH]) arquivos.push({ nome, ...(await hashArquivo(join(pasta, nome))) });
    const manifesto: Manifesto = { versao: 1, criada_em: criadaEm, migracao, tabelas, arquivos, objetos };
    await writeFile(join(pasta, ARQUIVO_MANIFESTO), JSON.stringify(manifesto, null, 1));

    // Escreve ao lado e renomeia no fim: uma cópia pela metade nunca fica com o nome final.
    await mkdir(dirname(o.saida), { recursive: true });
    const parcial = `${o.saida}.parcial`;
    const nomes = [ARQUIVO_MANIFESTO, ARQUIVO_BANCO, ARQUIVO_AUTH, ...objetos.map((x) => x.arquivo)];
    await pipeline(Readable.from(gerarTar(pasta, nomes)), cifrador(chave), createWriteStream(parcial));
    await rename(parcial, o.saida);
    return { bytes: (await stat(o.saida)).size, tabelas: Object.keys(tabelas).length, objetos: objetos.length, objetosSumidos: sumidos };
  } finally {
    await cliente.end().catch(() => undefined);
    await rm(pasta, { recursive: true, force: true });
  }
}

async function principal(): Promise<void> {
  const args = process.argv.slice(2);
  const env = process.env;
  const faltam = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'COPIA_CHAVE'].filter((k) => !env[k]);
  if (faltam.length) throw new Error(`Faltam as variáveis: ${faltam.join(', ')}.`);
  const saida = caminhoDoUsuario(argumento(args, '--saida') ?? `copia-${new Date().toISOString().slice(0, 10)}.enc`);
  const r = await fazerCopia({
    databaseUrl: env.DATABASE_URL!, supabaseUrl: env.SUPABASE_URL!, chaveServico: env.SUPABASE_SERVICE_ROLE_KEY!, chave: env.COPIA_CHAVE!, saida,
  });
  const mb = (r.bytes / 1024 / 1024).toFixed(1);
  console.log(`Cópia pronta: ${mb} MB (${r.bytes} bytes), ${r.tabelas} tabelas, ${r.objetos} arquivos.`);
  if (r.objetosSumidos) console.log(`Aviso: ${r.objetosSumidos} arquivo(s) foram apagados durante a cópia e ficaram de fora.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((e: unknown) => {
    const env = process.env;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`A cópia falhou: ${ocultar(msg, [senhaDaUrl(env.DATABASE_URL ?? ''), env.COPIA_CHAVE, env.SUPABASE_SERVICE_ROLE_KEY])}`);
    process.exit(1);
  });
}
