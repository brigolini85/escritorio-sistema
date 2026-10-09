// Auditoria 6.2: ensaio de cópia e restauração no Supabase local. Uma conversa com uma saída pendente, uma incerta, uma
// entrada não processada, um job enviar-mensagem e um anexo; e mais tudo o que o trabalhador retomaria sozinho (envio do
// Radar aprovado, aviso de tarefa, pedido ao cliente aprovado, pergunta ao assistente, tarefa "trabalhando"). A cópia; o
// "desastre"; a restauração. Depois, o trabalhador com o canal falso roda um batimento e os jobs que sobraram, e nada sai.
// O anexo volta com o mesmo hash.
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { limparBanco } from '@escritorio/db/teste';
import { CanalFalso } from '../../apps/trabalhador/src/canal/falso';
import { LimitadorEnvio, enviarMensagemDoPainel } from '../../apps/trabalhador/src/envio';
import { FILAS, criarBoss } from '../../apps/trabalhador/src/fila';
import { criarArmazenamento } from '../../apps/trabalhador/src/midia/armazenamento';
import { batimento, type DepsTarefas } from '../../apps/trabalhador/src/tarefas';
import { contatoComEmpresas, db, repos } from '../../apps/trabalhador/test/apoio/cenario';
import { FilaFalsa } from '../../apps/trabalhador/test/apoio/fila-falsa';
import { criarUsuarioTeste } from '../../apps/trabalhador/test/apoio/usuario';
import { cifrador, decifrador, lerChave } from './cifra';
import { fazerCopia } from './fazer-copia';
import { restaurar } from './restaurar';
import { gerarTar, lerTar } from './tar';

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
let usuario: string;
let fator: string;
let pergunta: string;
let tarefaTrabalhando: string;
let tarefaPendencias: string;
let pendencia: string;
let avisoTarefa: string;
let envioRadar: string;

async function sql<T = Record<string, unknown>>(texto: string, valores: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: databaseUrl });
  await c.connect();
  try { return (await c.query(texto, valores)).rows as T[]; } finally { await c.end(); }
}
const um = async <T = Record<string, unknown>>(texto: string, valores: unknown[] = []) => (await sql<T>(texto, valores))[0]!;
const ambienteAtual = async () => (await um<{ ambiente: string | null }>(`select ambiente from public.configuracoes where id = 1`)).ambiente;

beforeAll(async () => {
  if (!databaseUrl.includes('127.0.0.1') && !databaseUrl.includes('localhost')) throw new Error('Este teste só roda no banco local');
  pasta = await mkdtemp(join(tmpdir(), 'copia-teste-'));
  arquivo = join(pasta, 'copia.enc');
  await limparBanco();
  usuario = await criarUsuarioTeste({ email: 'copia-dono@teste.local', nome: 'Dono da cópia', telefone: '5531988880001' });
  const { empresas, contato, conversa } = await contatoComEmpresas(['Padaria Teste'], '5531999990001');
  const cliente = empresas[0]!.id;
  const antes = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
  const inserir = async (linha: Record<string, unknown>) => {
    const r = await db.from('mensagens').insert({ conversa_id: conversa.id, tipo: 'texto', ...linha } as never).select('id').single();
    if (r.error) throw r.error;
    return (r.data as { id: string }).id;
  };
  entrada = await inserir({ direcao: 'entrada', autor: 'cliente', conteudo: 'Bom dia, preciso da guia', criado_em: antes(30) });
  saidaPendente = await inserir({ direcao: 'saida', autor: 'atendente', conteudo: 'Segue a guia', status_envio: 'pendente', criado_em: antes(10) });
  saidaIncerta = await inserir({ direcao: 'saida', autor: 'agente', conteudo: 'Já te mando', status_envio: 'incerto', criado_em: antes(9) });
  const r = await db.storage.from('anexos').upload(caminhoAnexo, anexo, { contentType: 'application/pdf', upsert: true });
  if (r.error) throw r.error;
  await sql(`insert into public.travas_trabalhador (chave, dono, ate) values ('conversa:x', gen_random_uuid(), now() + interval '1 hour')`);
  await sql(`insert into public.instancias_trabalhador (id, hostname, ambiente, versao) values (gen_random_uuid(), 'antigo', 'producao', 'v1')`);
  // A produção com a remoção de arquivos sem dono ligada: numa homologação restaurada, isso apagaria objetos dela.
  await sql(`update public.configuracoes set ambiente = 'producao', varredura_orfaos_apagar = true where id = 1`);
  fator = (await um<{ id: string }>(`insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at, secret)
    values (gen_random_uuid(), $1, 'celular', 'totp', 'verified', now(), now(), 'SEGREDOTOTP') returning id`, [usuario])).id;
  pergunta = (await um<{ id: string }>(`insert into public.assistente_mensagens (usuario_id, canal, papel, conteudo, criado_em)
    values ($1, 'site', 'usuario', 'Quantas demandas abertas?', now() - interval '10 minutes') returning id`, [usuario])).id;
  const novoChamado = async () => (await um<{ id: string }>(`insert into public.chamados (titulo, cliente_id) values ('Guias do mês', $1) returning id`, [cliente])).id;
  const agente = (await um<{ id: string }>(`select id from public.agentes order by id limit 1`)).id;
  const tarefa = async (estado: string) => (await um<{ id: string }>(`insert into public.agente_tarefas
      (agente_id, chamado_id, cliente_id, pedida_por, pedido, estado, limite_usd, limite_minutos, avisar_whatsapp, atualizado_em)
    values ($1, $2, $3, $4, 'Conferir as guias do mês', $5, 2, 20, true, now() - interval '10 minutes') returning id`,
  [agente, await novoChamado(), cliente, usuario, estado])).id;
  tarefaTrabalhando = await tarefa('trabalhando');
  tarefaPendencias = await tarefa('aguardando_pendencias');
  pendencia = (await um<{ id: string }>(`insert into public.agente_pendencias
      (tarefa_id, numero, tipo, pergunta, contato_id, pedido_texto, pedido_por, pedido_em, pedidos)
    values ($1, 1, 'cliente', 'Qual o faturamento de março?', $2, 'Pode mandar o faturamento de março?', $3, now() - interval '10 minutes', 1)
    returning id`, [tarefaPendencias, contato.id, usuario])).id;
  avisoTarefa = (await um<{ id: string }>(`insert into public.agente_tarefa_avisos (tarefa_id, usuario_id, canal, tipo, chave, estado, mensagem, criado_em)
    values ($1, $2, 'whatsapp', 'pendencias', 'pendencias:1', 'pendente', 'Tarefa com 1 pendência para responder.', now() - interval '10 minutes')
    returning id`, [tarefaPendencias, usuario])).id;
  const setor = (await um<{ id: string }>(`select id from public.setores order by nome limit 1`)).id;
  const novidade = (await um<{ id: string }>(`insert into public.radar_novidades (titulo, url, url_normalizada, fonte_nome, selo, resumo, impacto)
    values ('Prazo novo da DCTFWeb', 'https://exemplo.gov.br/n1', 'exemplo.gov.br/n1', 'Receita', 'oficial', 'O prazo mudou para o dia 20.', 'alto')
    returning id`)).id;
  envioRadar = (await um<{ id: string }>(`insert into public.radar_envios (novidade_id, setor_id, cliente_id, contato_id, texto, aprovado_por, aprovado_em)
    values ($1, $2, $3, $4, 'O prazo da DCTFWeb mudou para o dia 20.', $5, now() - interval '10 minutes') returning id`,
  [novidade, setor, cliente, contato.id, usuario])).id;
  const boss = await criarBoss(databaseUrl);
  await boss.send(FILAS.enviarMensagem, { mensagemId: saidaPendente });
  await boss.stop({ graceful: false });
  await fazerCopia({ databaseUrl, supabaseUrl, chaveServico, chave, saida: arquivo, prefixoObjetos: prefixo });
});

afterAll(async () => {
  await db.storage.from('anexos').remove([caminhoAnexo]);
  await rm(pasta, { recursive: true, force: true });
  await limparBanco();
  await sql(`update public.configuracoes set varredura_orfaos_apagar = false where id = 1`);
});

const opcoesBase = () => ({ arquivo, chave, databaseUrl, supabaseUrl, chaveServico });

describe('restauração recusa antes de tocar no banco', () => {
  it('chave errada falha antes de conectar ao banco', async () => {
    const erro = await restaurar({ ...opcoesBase(), chave: randomBytes(32).toString('base64'),
      // Um banco que não existe: se a restauração tentasse conectar, o erro seria de conexão, não de chave.
      databaseUrl: 'postgresql://ninguem:nada@127.0.0.1:1/nada', substituir: true }).catch((e: unknown) => e);
    expect(String(erro)).toMatch(/chave errada ou o arquivo foi alterado/);
    expect((await um(`select status_envio from public.mensagens where id = $1`, [saidaPendente])).status_envio).toBe('pendente');
  });

  it('URL da produção sem a marca do dono é recusada, mesmo com PROJETO_PRODUCAO_REF vazio ou inválido', async () => {
    const prod = 'postgresql://postgres.xexinbtbzrjfgdxaaxla:x@aws-0-sa-east-1.pooler.supabase.com:5432/postgres';
    await expect(restaurar({ ...opcoesBase(), databaseUrl: prod, substituir: true })).rejects.toThrow(/produção/);
    await expect(restaurar({ ...opcoesBase(), supabaseUrl: 'https://xexinbtbzrjfgdxaaxla.supabase.co', substituir: true }))
      .rejects.toThrow(/produção/);
    for (const ref of ['', '   ', 'x', 'nao-e-ref']) {
      await expect(restaurar({ ...opcoesBase(), databaseUrl: prod, substituir: true, refProducao: ref })).rejects.toThrow(/produção/);
    }
    const antes = process.env.PROJETO_PRODUCAO_REF;
    process.env.PROJETO_PRODUCAO_REF = '';
    try {
      await expect(restaurar({ ...opcoesBase(), databaseUrl: prod, substituir: true })).rejects.toThrow(/produção/);
    } finally {
      if (antes === undefined) delete process.env.PROJETO_PRODUCAO_REF; else process.env.PROJETO_PRODUCAO_REF = antes;
    }
  });

  it('banco marcado como produção (configuracoes.ambiente) é recusado sem a marca do dono, pela URL que for', async () => {
    expect(await ambienteAtual()).toBe('producao');
    await expect(restaurar({ ...opcoesBase(), substituir: true })).rejects.toThrow(/banco de destino é a produção/);
    expect((await um(`select status_envio from public.mensagens where id = $1`, [saidaPendente])).status_envio).toBe('pendente');
  });

  it('banco com dados de clientes sem --substituir é recusado e fica como estava', async () => {
    await sql(`update public.configuracoes set ambiente = null where id = 1`);
    await expect(restaurar(opcoesBase())).rejects.toThrow(/--substituir/);
    expect((await um(`select status_envio from public.mensagens where id = $1`, [saidaPendente])).status_envio).toBe('pendente');
  });
});

describe('restauração completa num destino vazio (sem --substituir)', () => {
  beforeAll(async () => {
    // O desastre: os dados e os logins somem, o anexo some; o job enviar-mensagem continua na fila (pgboss não é apagado).
    await limparBanco();
    await sql(`delete from auth.users`);
    await sql(`update public.configuracoes set varredura_orfaos_apagar = false where id = 1`);
    await db.storage.from('anexos').remove([caminhoAnexo]);
    expect((await db.storage.from('anexos').download(caminhoAnexo)).error).not.toBeNull();
    const jobs = await sql(`select 1 from pgboss.job where name = $1 and state in ('created', 'retry', 'active')`, [FILAS.enviarMensagem]);
    expect(jobs.length).toBeGreaterThan(0);
    await restaurar({ ...opcoesBase(), ambiente: 'local' });
  });

  it('os dados, o login e o segundo fator voltam', async () => {
    const [m] = await sql<{ n: string }>(`select count(*) as n from public.mensagens where id = any($1)`, [[entrada, saidaPendente, saidaIncerta]]);
    expect(Number(m!.n)).toBe(3);
    expect((await sql(`select 1 from auth.users where email = 'copia-dono@teste.local'`)).length).toBe(1);
    expect((await sql(`select 1 from public.usuarios where email = 'copia-dono@teste.local'`)).length).toBe(1);
    expect((await sql(`select 1 from auth.mfa_factors where id = $1 and user_id = $2 and status = 'verified'`, [fator, usuario])).length).toBe(1);
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
    expect((await um<{ processada_em: Date | null }>(`select processada_em from public.mensagens where id = $1`, [entrada])).processada_em).not.toBeNull();
    const d = await sql<{ entrada: { mensagens: string[] } }>(`select entrada from public.decisoes_agente where etapa = 'restauracao' and entrada ? 'mensagens'`);
    expect(d.map((x) => x.entrada.mensagens).flat()).toEqual([entrada]);
  });

  it('a pergunta da equipe ao assistente fica processada', async () => {
    expect((await um<{ processada_em: Date | null }>(`select processada_em from public.assistente_mensagens where id = $1`, [pergunta])).processada_em)
      .not.toBeNull();
  });

  it('tarefa "trabalhando" fica pausada (pela pessoa, que retoma) com o evento da restauração', async () => {
    const t = await um<{ estado: string; motivo_pausa: string; executando_desde: Date | null }>(
      `select estado, motivo_pausa, executando_desde from public.agente_tarefas where id = $1`, [tarefaTrabalhando]);
    expect(t).toEqual({ estado: 'pausada', motivo_pausa: 'pessoa', executando_desde: null });
    expect((await sql(`select 1 from public.agente_tarefa_eventos where tarefa_id = $1 and quem = 'sistema' and texto like '%restauração%'`,
      [tarefaTrabalhando])).length).toBe(1);
    // A que espera pendências continua esperando (só a pessoa ou a resposta do cliente a movem).
    expect((await um(`select estado from public.agente_tarefas where id = $1`, [tarefaPendencias])).estado).toBe('aguardando_pendencias');
  });

  it('envio do Radar, aviso de tarefa e pedido ao cliente aprovados não saem; o aviso vai ao painel', async () => {
    expect((await um(`select estado from public.radar_envios where id = $1`, [envioRadar])).estado).toBe('nao_enviado');
    expect(await um(`select estado, motivo from public.agente_tarefa_avisos where id = $1`, [avisoTarefa]))
      .toEqual({ estado: 'nao_enviado', motivo: 'falha' });
    expect((await sql(`select 1 from public.agente_tarefa_avisos where tarefa_id = $1 and canal = 'painel' and chave = 'pendencias:1'`,
      [tarefaPendencias])).length).toBe(1);
    const p = await um<{ velho: boolean; pedido_enviado_em: Date | null }>(
      `select pedido_em < now() - interval '24 hours' as velho, pedido_enviado_em from public.agente_pendencias where id = $1`, [pendencia]);
    expect(p).toEqual({ velho: true, pedido_enviado_em: null });
  });

  it('fila vazia, travas soltas, instâncias apagadas, ambiente pedido e remoção de arquivos sem dono desligada', async () => {
    expect(await sql(`select 1 from pgboss.job where state in ('created', 'retry', 'active')`)).toEqual([]);
    expect(await sql(`select 1 from public.travas_trabalhador`)).toEqual([]);
    expect(await sql(`select 1 from public.instancias_trabalhador`)).toEqual([]);
    expect(await um(`select ambiente, varredura_orfaos_apagar from public.configuracoes where id = 1`))
      .toEqual({ ambiente: 'local', varredura_orfaos_apagar: false });
  });

  it('o anexo volta com o mesmo hash', async () => {
    const r = await db.storage.from('anexos').download(caminhoAnexo);
    expect(r.error).toBeNull();
    expect(sha(Buffer.from(await r.data!.arrayBuffer()))).toBe(sha(anexo));
  });

  it('o trabalhador com o canal falso roda um batimento e os jobs da fila, e nada é enviado nem enfileirado', async () => {
    const canal = new CanalFalso();
    const fila = new FilaFalsa();
    const envio = { repos, canal, limitador: new LimitadorEnvio(100), midia: criarArmazenamento(db), fila };
    const deps: DepsTarefas = { repos, canal, fila, envio, relogio: () => new Date(), email: { enviar: async () => undefined } as never,
      alertas: { alertar: async () => undefined } };
    await batimento(deps);
    // Nenhuma fila recebe nada (envio, conversa, assistente, tarefa, pedido ao cliente, aviso).
    expect(fila.enviados).toEqual([]);
    const boss = await criarBoss(databaseUrl);
    try {
      const doBoss = await boss.fetch<{ mensagemId: string }>(FILAS.enviarMensagem, { batchSize: 50 });
      for (const j of doBoss) await enviarMensagemDoPainel(envio, j.data.mensagemId);
      expect(doBoss).toEqual([]);
    } finally {
      await boss.stop({ graceful: false });
    }
    expect(canal.enviados).toEqual([]);
  });
});

describe('restauração com --substituir', () => {
  it('sem --ambiente, o banco fica com o ambiente que o destino já tinha', async () => {
    await sql(`update public.configuracoes set ambiente = 'homologacao' where id = 1`);
    await restaurar({ ...opcoesBase(), substituir: true });
    expect(await ambienteAtual()).toBe('homologacao');
  });

  it('contagem diferente do manifesto desfaz tudo', async () => {
    // Uma cópia íntegra (cifrada com a chave certa) cujo manifesto diz uma mensagem a mais.
    const dir = await mkdtemp(join(pasta, 'alterada-'));
    const tar = join(dir, 'c.tar');
    await pipeline(createReadStream(arquivo), decifrador(lerChave(chave)), createWriteStream(tar));
    const nomes = await lerTar(createReadStream(tar), join(dir, 'c'));
    const m = JSON.parse(await readFile(join(dir, 'c', 'manifesto.json'), 'utf8'));
    m.tabelas['public.mensagens'] += 1;
    await writeFile(join(dir, 'c', 'manifesto.json'), JSON.stringify(m));
    const alterada = join(dir, 'alterada.enc');
    await pipeline(Readable.from(gerarTar(join(dir, 'c'), nomes)), cifrador(lerChave(chave)), createWriteStream(alterada));

    // Marcas no destino que a restauração apagaria se fosse adiante.
    await sql(`update public.configuracoes set ambiente = 'local' where id = 1`);
    await sql(`update public.mensagens set conteudo = 'marca do destino' where id = $1`, [entrada]);
    const decisoes = Number((await um<{ n: string }>(`select count(*) as n from public.decisoes_agente`)).n);
    await expect(restaurar({ ...opcoesBase(), arquivo: alterada, substituir: true, ambiente: 'homologacao' }))
      .rejects.toThrow(/contagem não bate com o manifesto/);
    expect((await um(`select conteudo from public.mensagens where id = $1`, [entrada])).conteudo).toBe('marca do destino');
    expect(Number((await um<{ n: string }>(`select count(*) as n from public.decisoes_agente`)).n)).toBe(decisoes);
    expect(await ambienteAtual()).toBe('local');
    expect((await sql(`select 1 from auth.users where email = 'copia-dono@teste.local'`)).length).toBe(1);
  });
});
