// Auditoria 6.2: restauração de uma cópia feita por fazer-copia.ts, sem reenviar nada aos clientes.
//   pnpm copia:restaurar <copia.enc> [--substituir] [--ambiente producao|homologacao|local] [--pasta <pasta>] [--sou-o-dono-e-quero-a-producao]
// Variáveis: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e COPIA_CHAVE do projeto de DESTINO (e a chave da cópia).
// Destino: um projeto Supabase com as migrações aplicadas (supabase db push) na mesma versão da cópia ou mais nova:
// um projeto novo e vazio, ou a homologação com --substituir. Ordem:
//   1. recusa a produção sem --sou-o-dono-e-quero-a-producao: pela URL antes de abrir a cópia e, no passo 3, pelo
//      configuracoes.ambiente do próprio destino;
//   2. decifra numa pasta temporária e confere o manifesto (hash de cada arquivo); chave errada para aqui, sem tocar no banco;
//   3. confere o destino (migrações, dados de clientes; com dados, só com --substituir);
//   4. numa transação só: apaga os dados do destino, carrega os da cópia, confere as contagens do manifesto e roda
//      depois-de-restaurar.sql; qualquer erro desfaz tudo;
//   5. envia os arquivos de volta aos buckets (substitui os de mesmo nome).
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { decifrador, lerChave } from './cifra';
import {
  AMBIENTES, ARQUIVO_AUTH, ARQUIVO_BANCO, ARQUIVO_MANIFESTO, NOME_TABELA, argumento, cabecalhosServico,
  caminhoDoUsuario, ehProducao, hashArquivo, ocultar, refProducao, senhaDaUrl, urlObjeto, type Ambiente, type Manifesto,
} from './comum';
import { rodarPg } from './pg';
import { lerTar } from './tar';

export type OpcoesRestaurar = {
  arquivo: string;
  /** COPIA_CHAVE (base64) com que a cópia foi feita. */
  chave: string;
  databaseUrl: string;
  supabaseUrl: string;
  chaveServico: string;
  /** Apaga os dados que o destino já tem (clientes, conversas, logins). */
  substituir?: boolean;
  /** configuracoes.ambiente depois da restauração. Sem ele: o que o destino já tinha; destino sem ambiente: o da cópia. */
  ambiente?: Ambiente;
  souODono?: boolean;
  refProducao?: string;
  /**
   * Onde ficam os arquivos decifrados durante a restauração (padrão: a pasta temporária do sistema, %TEMP% no Windows).
   * Use uma pasta num disco cifrado (BitLocker); a pasta é apagada no fim, com erro ou sem.
   */
  pasta?: string;
};

export type ResumoRestauracao = { tabelas: number; objetos: number; ambiente: string | null; avisos: string[] };

const SQL_DEPOIS = fileURLToPath(new URL('./depois-de-restaurar.sql', import.meta.url));

/** Abre a cópia numa pasta temporária e confere o manifesto. Erro: a pasta é apagada e nada no banco foi tocado. */
async function abrirCopia(arquivo: string, chave: Buffer, temporaria: string): Promise<{ m: Manifesto; pasta: string }> {
  // Primeiro decifra inteiro para um .tar (a marca GCM do fim confere a chave e a integridade); só depois lê o pacote:
  // nada não autenticado é interpretado, e a chave errada dá o erro de chave (não um pacote "corrompido").
  const tar = join(temporaria, 'copia.tar');
  const pasta = join(temporaria, 'copia');
  await pipeline(createReadStream(arquivo), decifrador(chave), createWriteStream(tar));
  const escritos = await lerTar(createReadStream(tar), pasta);
  await rm(tar);
  if (!escritos.includes(ARQUIVO_MANIFESTO)) throw new Error('Cópia sem manifesto.');
  const m = JSON.parse(await readFile(join(pasta, ARQUIVO_MANIFESTO), 'utf8')) as Manifesto;
  if (m.versao !== 1) throw new Error(`Manifesto na versão ${String(m.versao)}; este programa lê a versão 1.`);
  for (const t of Object.keys(m.tabelas)) if (!NOME_TABELA.test(t)) throw new Error(`Manifesto com tabela inválida: ${t}`);
  if (Number.isNaN(Date.parse(m.criada_em))) throw new Error('Manifesto sem a data da cópia.');
  const esperados = [...m.arquivos.map((a) => ({ nome: a.nome, sha256: a.sha256 })), ...m.objetos.map((o) => ({ nome: o.arquivo, sha256: o.sha256 }))];
  for (const nome of [ARQUIVO_BANCO, ARQUIVO_AUTH]) if (!m.arquivos.some((a) => a.nome === nome)) throw new Error(`Cópia sem ${nome}.`);
  for (const e of esperados) {
    if (!escritos.includes(e.nome)) throw new Error(`Cópia sem o arquivo ${e.nome} do manifesto.`);
    if ((await hashArquivo(join(pasta, e.nome))).sha256 !== e.sha256) throw new Error(`O arquivo ${e.nome} não confere com o manifesto.`);
  }
  if (escritos.length !== esperados.length + 1) throw new Error('A cópia tem arquivos fora do manifesto.');
  return { m, pasta };
}

type Destino = { tabelas: string[]; ambiente: string | null; avisos: string[] };

async function conferirDestino(o: OpcoesRestaurar, m: Manifesto): Promise<Destino> {
  const c = new pg.Client({ connectionString: o.databaseUrl });
  await c.connect();
  try {
    const q = async <T>(texto: string) => (await c.query(texto)).rows as T[];
    const [pronto] = await q<{ ok: boolean }>(`select to_regclass('public.mensagens') is not null and to_regclass('public.configuracoes') is not null as ok`);
    if (!pronto!.ok) throw new Error('O banco de destino não tem as tabelas do sistema. Aplique as migrações antes (supabase db push).');
    const avisos: string[] = [];
    const [mig] = await q<{ v: string | null }>(`select case when to_regclass('supabase_migrations.schema_migrations') is null then null
      else (select max(version) from supabase_migrations.schema_migrations) end as v`);
    const destinoMig = mig!.v;
    if (m.migracao && destinoMig && destinoMig < m.migracao) {
      throw new Error(`O banco de destino está na migração ${destinoMig}, mais antiga que a da cópia (${m.migracao}). Aplique as migrações antes.`);
    }
    if (m.migracao && destinoMig && destinoMig > m.migracao) avisos.push(`O destino tem migrações mais novas (${destinoMig}) que a cópia (${m.migracao}).`);
    // Revisão da Task 18: o próprio banco diz se é a produção (Auditoria 4.3), seja qual for a URL (domínio próprio, ref
    // novo depois de um desastre, PROJETO_PRODUCAO_REF errado).
    const [amb] = await q<{ ambiente: string | null }>(`select ambiente from public.configuracoes where id = 1`);
    if (amb?.ambiente === 'producao' && !o.souODono) {
      throw new Error('O banco de destino é a produção (configuracoes.ambiente = producao). Restaurar apaga os dados de lá; só o dono faz isso, '
        + 'com --sou-o-dono-e-quero-a-producao.');
    }
    const [dados] = await q<{ tem: boolean }>(`select exists (select 1 from public.clientes) or exists (select 1 from public.contatos)
      or exists (select 1 from public.conversas) or exists (select 1 from public.mensagens) or exists (select 1 from auth.users) as tem`);
    if (dados!.tem && !o.substituir) {
      throw new Error('O banco de destino já tem dados (clientes, conversas ou logins). Para apagar tudo e pôr a cópia no lugar, rode de novo com --substituir.');
    }
    const tabelas = (await q<{ nome: string }>(
      `select 'public.' || c.relname as nome from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition order by 1`)).map((r) => r.nome);
    const faltam = Object.keys(m.tabelas).filter((t) => t.startsWith('public.') && !tabelas.includes(t));
    if (faltam.length) throw new Error(`O destino não tem as tabelas ${faltam.join(', ')}. Aplique as migrações da mesma versão da cópia.`);
    return { tabelas, ambiente: amb?.ambiente ?? null, avisos };
  } finally {
    await c.end().catch(() => undefined);
  }
}

const literal = (s: string) => `'${s.replace(/'/g, "''")}'`;

function sqlContagens(m: Manifesto): string {
  const linhas = Object.entries(m.tabelas).map(([t, n]) =>
    `  select count(*) into v from ${t}; if v <> ${Math.trunc(n)} then erros := erros || ' ${t}: ' || v || ' em vez de ${Math.trunc(n)};'; end if;`);
  return `do $$
declare v bigint; erros text := '';
begin
${linhas.join('\n')}
  if erros <> '' then raise exception 'A contagem não bate com o manifesto:%', erros; end if;
end $$;
`;
}

/** Tudo numa transação do psql: apaga, carrega (gatilhos desligados, como no pg_restore), confere e roda o depois. */
async function carregarBanco(o: OpcoesRestaurar, m: Manifesto, destino: Destino, pasta: string, ambiente: string): Promise<void> {
  const depois = await readFile(SQL_DEPOIS, 'utf8');
  const inicio = `begin;
truncate ${destino.tabelas.join(', ')};
delete from auth.users;
set local session_replication_role = replica;
`;
  const fim = `
set local session_replication_role = origin;
${sqlContagens(m)}
set local "copia.momento" = ${literal(m.criada_em)};
set local "copia.ambiente" = ${literal(ambiente)};
${depois}
commit;
`;
  async function* entrada(): AsyncGenerator<Buffer> {
    yield Buffer.from(inicio);
    for (const nome of [ARQUIVO_BANCO, ARQUIVO_AUTH]) {
      // pg_restore sem -d só escreve o SQL (COPY ...) no stdout; não conecta.
      const r = rodarPg('pg_restore', ['--data-only', '--no-owner', '--no-privileges', '-f', '-'], o.databaseUrl,
        { entrada: createReadStream(join(pasta, nome)) });
      for await (const p of r.stdout) yield p as Buffer;
      await r.fim;
    }
    yield Buffer.from(fim);
  }
  let erroEntrada: unknown = null;
  const fonte = Readable.from(entrada());
  fonte.on('error', (e) => { erroEntrada = e; });
  const psql = rodarPg('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1'], o.databaseUrl, { entrada: fonte });
  psql.stdout.resume();
  // Sem o "commit" no fim (entrada quebrada), o psql sai e a transação é desfeita.
  await psql.fim.catch((e: unknown) => { throw erroEntrada ?? e; });
  if (erroEntrada) throw erroEntrada;
}

async function enviarObjetos(o: OpcoesRestaurar, m: Manifesto, pasta: string): Promise<void> {
  for (const obj of m.objetos) {
    const corpo = await readFile(join(pasta, obj.arquivo));
    const r = await fetch(urlObjeto(o.supabaseUrl, obj.bucket, obj.nome), {
      method: 'POST', body: corpo,
      headers: { ...cabecalhosServico(o.chaveServico), 'x-upsert': 'true', 'Content-Type': obj.tipo ?? 'application/octet-stream' },
    });
    if (!r.ok) {
      const texto = (await r.text().catch(() => '')).slice(0, 300);
      throw new Error(`Storage respondeu ${r.status} ao enviar o arquivo ${obj.arquivo} (bucket ${obj.bucket}): ${ocultar(texto, [o.chaveServico])}. `
        + 'O banco já foi restaurado; rode a restauração de novo com --substituir para reenviar os arquivos.');
    }
  }
}

export async function restaurar(o: OpcoesRestaurar): Promise<ResumoRestauracao> {
  // 1. Produção só com a marca do dono, antes de qualquer outra coisa.
  const ref = refProducao(o.refProducao ?? process.env.PROJETO_PRODUCAO_REF);
  const bancoProd = ehProducao(o.databaseUrl, ref);
  const apiProd = ehProducao(o.supabaseUrl, ref);
  if ((bancoProd || apiProd) && !o.souODono) {
    throw new Error('Este destino é a produção. Restaurar apaga os dados de lá; só o dono faz isso, com --sou-o-dono-e-quero-a-producao.');
  }
  if (bancoProd !== apiProd) throw new Error('DATABASE_URL e SUPABASE_URL são de projetos diferentes (um é a produção, o outro não).');
  if (o.ambiente && !AMBIENTES.includes(o.ambiente)) throw new Error(`--ambiente deve ser ${AMBIENTES.join(', ')}.`);
  const chave = lerChave(o.chave);

  // 2. Abre e confere a cópia sem tocar no banco.
  const temporaria = await mkdtemp(join(o.pasta ?? tmpdir(), 'restaurar-'));
  try {
    const { m, pasta } = await abrirCopia(o.arquivo, chave, temporaria);
    // 3. Confere o destino.
    const destino = await conferirDestino(o, m);
    const ambiente = o.ambiente ?? destino.ambiente ?? '';
    // 4. Banco, numa transação só.
    await carregarBanco(o, m, destino, pasta, ambiente);
    // 5. Arquivos.
    await enviarObjetos(o, m, pasta);
    return { tabelas: Object.keys(m.tabelas).length, objetos: m.objetos.length, ambiente: ambiente || null, avisos: destino.avisos };
  } finally {
    await rm(temporaria, { recursive: true, force: true });
  }
}

async function principal(): Promise<void> {
  const args = process.argv.slice(2);
  const env = process.env;
  const arquivo = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--ambiente' && args[i - 1] !== '--pasta');
  if (!arquivo) throw new Error('Uso: pnpm copia:restaurar <copia.enc> [--substituir] [--ambiente producao|homologacao|local] [--pasta <pasta num disco cifrado>]');
  const faltam = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'COPIA_CHAVE'].filter((k) => !env[k]);
  if (faltam.length) throw new Error(`Faltam as variáveis: ${faltam.join(', ')}.`);
  const inicio = Date.now();
  const r = await restaurar({
    arquivo: caminhoDoUsuario(arquivo), chave: env.COPIA_CHAVE!, databaseUrl: env.DATABASE_URL!, supabaseUrl: env.SUPABASE_URL!,
    chaveServico: env.SUPABASE_SERVICE_ROLE_KEY!, substituir: args.includes('--substituir'),
    ambiente: argumento(args, '--ambiente') as Ambiente | undefined, souODono: args.includes('--sou-o-dono-e-quero-a-producao'),
    pasta: argumento(args, '--pasta') ? caminhoDoUsuario(argumento(args, '--pasta')!) : undefined,
  });
  for (const a of r.avisos) console.log(`Aviso: ${a}`);
  console.log(`Restauração pronta em ${Math.round((Date.now() - inicio) / 1000)} s: ${r.tabelas} tabelas, ${r.objetos} arquivos, ambiente ${r.ambiente ?? 'da cópia'}.`);
  console.log('Nada foi reenviado. Confira o painel e só então ligue o trabalhador.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  principal().catch((e: unknown) => {
    const env = process.env;
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`A restauração falhou: ${ocultar(msg, [senhaDaUrl(env.DATABASE_URL ?? ''), env.COPIA_CHAVE, env.SUPABASE_SERVICE_ROLE_KEY])}`);
    process.exit(1);
  });
}
