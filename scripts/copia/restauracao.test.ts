// Auditoria 6.2: ensaio de cópia e restauração no Supabase local. Uma conversa com uma saída pendente, uma incerta, uma
// entrada não processada, um job enviar-mensagem e um anexo; a cópia; o "desastre"; a restauração. Depois, o trabalhador
// com o canal falso roda um batimento e os jobs que sobraram, e nada sai para o cliente. O anexo volta com o mesmo hash.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../../apps/trabalhador/src/canal/falso';
import { LimitadorEnvio, enviarMensagemDoPainel } from '../../apps/trabalhador/src/envio';
import { FILAS, criarBoss } from '../../apps/trabalhador/src/fila';
import { criarArmazenamento } from '../../apps/trabalhador/src/midia/armazenamento';
import { batimento, type DepsTarefas } from '../../apps/trabalhador/src/tarefas';
import { db, repos } from '../../apps/trabalhador/test/apoio/cenario';
import { FilaFalsa } from '../../apps/trabalhador/test/apoio/fila-falsa';
import { criarUsuarioTeste } from '../../apps/trabalhador/test/apoio/usuario';
import { fazerCopia } from './fazer-copia';
import { restaurar } from './restaurar';

const databaseUrl = process.env.DATABASE_URL!;
const supabaseUrl = process.env.SUPABASE_URL!;
const chaveServico = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const chave = randomBytes(32).toString('base64');
const prefixo = `copia-teste-${randomUUID()}`;
const caminhoAnexo = `${prefixo}/nota fiscal (03).pdf`;
const anexo = randomBytes(70_000);
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

let pasta: string;
let arquivo: string;
let saidaPendente: string;
let saidaIncerta: string;
let entrada: string;

async function sql<T = Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  try { return (await c.query(texto, valores)).rows as T[]; } finally { await c.end(); }
}

async function enviarAnexo(): Promise<void> {
  const r = await db.storage.from('anexos').upload(caminhoAnexo, anexo, { contentType: 'application/pdf', upsert: true });
  if (r.error) throw r.error;
}

beforeAll(async () => {
  if (!databaseUrl.includes('127.0.0.1') && !databaseUrl.includes('localhost')) throw new Error('Este teste só roda no banco local');
  pasta = await mkdtemp(join(tmpdir(), 'copia-teste-'));
  arquivo = join(pasta, 'copia.enc');
  await limparBanco();
  await criarUsuarioTeste({ email: 'copia-dono@teste.local', nome: 'Dono da cópia' });
  const conversa = await repos.obterOuCriarConversa('5531999990001', null);
  const antes = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const inserir = async (linha: Record<string, unknown>) => {
    const r = await db.from('mensagens').insert({ conversa_id: conversa.id, tipo: 'texto', ...linha } as never).select('id').single();
    if (r.error) throw r.error;
    return (r.data as { id: string }).id;
  };
  entrada = await inserir({ direcao: 'entrada', autor: 'cliente', conteudo: 'Bom dia, preciso da guia', criado_em: antes(30) });
  saidaPendente = await inserir({ direcao: 'saida', autor: 'atendente', conteudo: 'Segue a guia', status_envio: 'pendente', criado_em: antes(10) });
  saidaIncerta = await inserir({ direcao: 'saida', autor: 'agente', conteudo: 'Já te mando', status_envio: 'incerto', criado_em: antes(9) });
  await enviarAnexo();
  await sql(`insert into public.travas_trabalhador (chave, dono, ate) values ('conversa:x', gen_random_uuid(), now() + interval '1 hour')`);
  await sql(`insert into public.instancias_trabalhador (id, hostname, ambiente, versao) values (gen_random_uuid(), 'antigo', 'producao', 'v1')`);
  await sql(`update public.configuracoes set ambiente = 'producao' where id = 1`);
  const boss = await criarBoss(databaseUrl);
  await boss.send(FILAS.enviarMensagem, { mensagemId: saidaPendente });
  await boss.stop({ graceful: false });
  await fazerCopia({ databaseUrl, supabaseUrl, chaveServico, chave, saida: arquivo, prefixoObjetos: prefixo });
});

afterAll(async () => {
  await db.storage.from('anexos').remove([caminhoAnexo]);
  await rm(pasta, { recursive: true, force: true });
  await limparBanco();
});

const opcoesBase = () => ({ arquivo, chave, databaseUrl, supabaseUrl, chaveServico });

describe('restauração recusa antes de tocar no banco', () => {
  it('chave errada falha antes de conectar ao banco', async () => {
    const erro = await restaurar({ ...opcoesBase(), chave: randomBytes(32).toString('base64'),
      // Um banco que não existe: se a restauração tentasse conectar, o erro seria de conexão, não de chave.
      databaseUrl: 'postgresql://ninguem:nada@127.0.0.1:1/nada', substituir: true }).catch((e: unknown) => e);
    expect(String(erro)).toMatch(/chave errada ou o arquivo foi alterado/);
    expect((await sql(`select status_envio from public.mensagens where id = $1`, [saidaPendente]))[0]!.status_envio).toBe('pendente');
  });

  it('URL da produção sem a marca do dono é recusada', async () => {
    const prod = 'postgresql://postgres.xexinbtbzrjfgdxaaxla:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';
    await expect(restaurar({ ...opcoesBase(), databaseUrl: prod, substituir: true })).rejects.toThrow(/produção/);
    await expect(restaurar({ ...opcoesBase(), supabaseUrl: 'https://xexinbtbzrjfgdxaaxla.supabase.co', substituir: true }))
      .rejects.toThrow(/produção/);
  });

  it('banco com dados de clientes sem --substituir é recusado e fica como estava', async () => {
    await expect(restaurar(opcoesBase())).rejects.toThrow(/--substituir/);
    expect((await sql(`select status_envio from public.mensagens where id = $1`, [saidaPendente]))[0]!.status_envio).toBe('pendente');
  });
});

describe('restauração completa', () => {
  beforeAll(async () => {
    // O desastre: os dados somem, o anexo some; o job enviar-mensagem continua na fila (pgboss não é apagado).
    await limparBanco();
    await db.storage.from('anexos').remove([caminhoAnexo]);
    expect((await db.storage.from('anexos').download(caminhoAnexo)).error).not.toBeNull();
    const jobs = await sql(`select 1 from pgboss.job where name = $1 and state in ('created', 'retry', 'active')`, [FILAS.enviarMensagem]);
    expect(jobs.length).toBeGreaterThan(0);
    await restaurar({ ...opcoesBase(), substituir: true, ambiente: 'local' });
  });

  it('os dados e o login voltam', async () => {
    const [m] = await sql<{ n: string }>(`select count(*) as n from public.mensagens where id = any($1)`, [[entrada, saidaPendente, saidaIncerta]]);
    expect(Number(m!.n)).toBe(3);
    expect((await sql(`select 1 from auth.users where email = 'copia-dono@teste.local'`)).length).toBe(1);
    expect((await sql(`select 1 from public.usuarios where email = 'copia-dono@teste.local'`)).length).toBe(1);
  });

  it('saídas pendente e incerta viram falhou, com a nota "restauração"', async () => {
    const linhas = await sql<{ id: string; status_envio: string }>(`select id, status_envio from public.mensagens where id = any($1)`, [[saidaPendente, saidaIncerta]]);
    expect(linhas.map((l) => l.status_envio)).toEqual(['falhou', 'falhou']);
    const notas = await sql<{ justificativa: string; saida: { mensagens: string[] } }>(
      `select justificativa, saida from public.decisoes_agente where etapa = 'restauracao' and saida ? 'mensagens' and justificativa like '%saída%'`);
    expect(notas.length).toBe(1);
    expect(notas[0]!.justificativa).toMatch(/restauração/);
    expect(notas[0]!.saida.mensagens.sort()).toEqual([saidaPendente, saidaIncerta].sort());
  });

  it('a entrada não processada vira processada, com a decisão restauracao', async () => {
    expect((await sql<{ processada_em: Date | null }>(`select processada_em from public.mensagens where id = $1`, [entrada]))[0]!.processada_em).not.toBeNull();
    const d = await sql<{ entrada: { mensagens: string[] } }>(`select entrada from public.decisoes_agente where etapa = 'restauracao' and entrada ? 'mensagens'`);
    expect(d.map((x) => x.entrada.mensagens).flat()).toEqual([entrada]);
  });

  it('fila vazia, travas soltas, instâncias apagadas e o ambiente pedido', async () => {
    expect(await sql(`select 1 from pgboss.job where state in ('created', 'retry', 'active')`)).toEqual([]);
    expect(await sql(`select 1 from public.travas_trabalhador`)).toEqual([]);
    expect(await sql(`select 1 from public.instancias_trabalhador`)).toEqual([]);
    expect((await sql<{ ambiente: string }>(`select ambiente from public.configuracoes where id = 1`))[0]!.ambiente).toBe('local');
  });

  it('o anexo volta com o mesmo hash', async () => {
    const r = await db.storage.from('anexos').download(caminhoAnexo);
    expect(r.error).toBeNull();
    expect(sha(Buffer.from(await r.data!.arrayBuffer()))).toBe(sha(anexo));
  });

  it('o trabalhador com o canal falso roda um batimento e os jobs da fila, e nada é enviado', async () => {
    const canal = new CanalFalso();
    const fila = new FilaFalsa();
    const envio = { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db), fila };
    const deps: DepsTarefas = { repos, canal, fila, envio, relogio: () => new Date(), email: { enviar: async () => undefined } as never,
      alertas: { alertar: async () => undefined } };
    await batimento(deps);
    // O que o batimento pôs na fila e o que ainda estiver no pg-boss passam pelo envio de verdade.
    const boss = await criarBoss(databaseUrl);
    try {
      const doBoss = await boss.fetch<{ mensagemId: string }>(FILAS.enviarMensagem, { batchSize: 50 });
      const ids = [...fila.enviados.filter((j) => j.nome === FILAS.enviarMensagem).map((j) => j.dados.mensagemId as string),
        ...doBoss.map((j) => j.data.mensagemId)];
      for (const id of ids) await enviarMensagemDoPainel(envio, id);
      expect(ids).toEqual([]);
    } finally {
      await boss.stop({ graceful: false });
    }
    expect(fila.enviados.filter((j) => j.nome === FILAS.processarConversa)).toEqual([]);
    expect(canal.enviados).toEqual([]);
  });
});
