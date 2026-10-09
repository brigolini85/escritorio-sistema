// Auditoria 6.2: a cópia é cifrada (AES-256-GCM, em fluxo), a chave errada ou o arquivo alterado falham, o pacote .tar
// não escreve fora da pasta e a restauração recusa a produção sem a marca do dono.
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CABECALHO_BYTES, VERSAO_FORMATO, cifrador, decifrador, lerChave } from './cifra';
import { ehProducao, ocultar } from './comum';
import { ambientePg } from './pg';
import { gerarTar, lerTar } from './tar';

let pasta: string;
beforeEach(async () => { pasta = await mkdtemp(join(tmpdir(), 'copia-unid-')); });
afterEach(async () => { await rm(pasta, { recursive: true, force: true }); });

const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');

async function cifrarBuffer(dados: Buffer, chave: Buffer): Promise<Buffer> {
  const saida = join(pasta, 'x.enc');
  await pipeline(Readable.from([dados.subarray(0, 1000), dados.subarray(1000)]), cifrador(chave), createWriteStream(saida));
  return readFile(saida);
}

async function decifrarBuffer(cifrado: Buffer, chave: Buffer): Promise<Buffer> {
  const partes: Buffer[] = [];
  // Pedaços pequenos: a marca de autenticação (16 bytes do fim) chega quebrada entre pedaços.
  const pedacos = [];
  for (let i = 0; i < cifrado.length; i += 7) pedacos.push(cifrado.subarray(i, i + 7));
  await pipeline(Readable.from(pedacos), decifrador(chave), async (fonte: AsyncIterable<Buffer>) => { for await (const p of fonte) partes.push(p); });
  return Buffer.concat(partes);
}

describe('cifra (AES-256-GCM em fluxo)', () => {
  const chave = randomBytes(32);
  const dados = randomBytes(300_000);

  it('cifra e decifra de volta; o arquivo começa pela marca e pela versão do formato', async () => {
    const cifrado = await cifrarBuffer(dados, chave);
    expect(cifrado.subarray(0, 8).toString('ascii')).toBe('ESCCOPIA');
    expect(cifrado[8]).toBe(VERSAO_FORMATO);
    // cabeçalho + IV de 12 bytes + dados + marca de 16 bytes
    expect(cifrado.length).toBe(CABECALHO_BYTES + 12 + dados.length + 16);
    expect(sha(await decifrarBuffer(cifrado, chave))).toBe(sha(dados));
  });

  it('cada cópia tem um IV novo (o mesmo conteúdo cifra diferente)', async () => {
    const a = await cifrarBuffer(dados, chave);
    const b = await cifrarBuffer(dados, chave);
    expect(a.subarray(CABECALHO_BYTES, CABECALHO_BYTES + 12).equals(b.subarray(CABECALHO_BYTES, CABECALHO_BYTES + 12))).toBe(false);
  });

  it('chave errada falha', async () => {
    const cifrado = await cifrarBuffer(dados, chave);
    await expect(decifrarBuffer(cifrado, randomBytes(32))).rejects.toThrow(/chave errada ou o arquivo foi alterado/);
  });

  it('um byte alterado no meio falha', async () => {
    const cifrado = await cifrarBuffer(dados, chave);
    cifrado[5000] = cifrado[5000]! ^ 1;
    await expect(decifrarBuffer(cifrado, chave)).rejects.toThrow(/chave errada ou o arquivo foi alterado/);
  });

  it('versão de formato desconhecida e arquivo que não é cópia falham', async () => {
    const cifrado = await cifrarBuffer(dados, chave);
    cifrado[8] = 99;
    await expect(decifrarBuffer(cifrado, chave)).rejects.toThrow(/versão 99/);
    await expect(decifrarBuffer(Buffer.from('não é uma cópia, só texto qualquer bem comprido'), chave)).rejects.toThrow(/não é uma cópia/);
    await expect(decifrarBuffer(Buffer.from('curto'), chave)).rejects.toThrow(/não é uma cópia/);
  });

  it('a chave precisa ter 32 bytes em base64', () => {
    expect(lerChave(randomBytes(32).toString('base64')).length).toBe(32);
    expect(() => lerChave(randomBytes(16).toString('base64'))).toThrow(/32 bytes/);
    expect(() => lerChave(undefined)).toThrow(/COPIA_CHAVE/);
    expect(() => lerChave('')).toThrow(/COPIA_CHAVE/);
  });
});

describe('pacote .tar', () => {
  it('empacota e desempacota com o mesmo conteúdo', async () => {
    const origem = join(pasta, 'origem');
    const destino = join(pasta, 'destino');
    await rm(origem, { recursive: true, force: true });
    await mkdir(join(origem, 'objetos'), { recursive: true });
    const a = randomBytes(1025);
    const b = Buffer.alloc(0);
    await writeFile(join(origem, 'manifesto.json'), '{"a":1}');
    await writeFile(join(origem, 'objetos', '000001'), a);
    await writeFile(join(origem, 'objetos', '000002'), b);
    const tar = join(pasta, 'p.tar');
    await pipeline(Readable.from(gerarTar(origem, ['manifesto.json', 'objetos/000001', 'objetos/000002'])), createWriteStream(tar));
    expect((await readFile(tar)).length % 512).toBe(0);
    await mkdir(destino);
    await lerTar(createReadStream(tar), destino);
    expect(await readFile(join(destino, 'manifesto.json'), 'utf8')).toBe('{"a":1}');
    expect(sha(await readFile(join(destino, 'objetos', '000001')))).toBe(sha(a));
    expect((await readFile(join(destino, 'objetos', '000002'))).length).toBe(0);
    expect((await readdir(destino)).sort()).toEqual(['manifesto.json', 'objetos']);
  });

  it('recusa nome que sai da pasta', async () => {
    const origem = join(pasta, 'o2');
    await mkdir(origem);
    await writeFile(join(origem, 'x'), 'x');
    // Monta o .tar com um nome perigoso trocando o nome no cabeçalho (o gerador também recusa).
    const partes: Buffer[] = [];
    for await (const p of gerarTar(origem, ['x'])) partes.push(p);
    const tar = Buffer.concat(partes);
    tar.write('../fora\0', 0, 'ascii');
    // Checksum refeito para o leitor chegar a olhar o nome.
    tar.fill(' ', 148, 156);
    let soma = 0;
    for (let i = 0; i < 512; i++) soma += tar[i]!;
    tar.write(soma.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
    await expect(lerTar(Readable.from([tar]), join(pasta, 'd2'))).rejects.toThrow(/nome recusado/);
    await expect((async () => { for await (const _ of gerarTar(origem, ['../x'])) { /* nada */ } })()).rejects.toThrow(/nome recusado/);
  });
});

describe('guarda da produção', () => {
  it('reconhece a produção pelo ref no endereço ou no usuário', () => {
    const ref = 'xexinbtbzrjfgdxaaxla';
    expect(ehProducao(`postgresql://postgres:s@db.${ref}.supabase.co:5432/postgres`, ref)).toBe(true);
    expect(ehProducao(`postgresql://postgres.${ref}:s@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`, ref)).toBe(true);
    expect(ehProducao(`https://${ref}.supabase.co`, ref)).toBe(true);
    expect(ehProducao('postgresql://postgres.outroref:s@aws-0-sa-east-1.pooler.supabase.com:5432/postgres', ref)).toBe(false);
    expect(ehProducao('postgresql://postgres:postgres@127.0.0.1:54322/postgres', ref)).toBe(false);
    // A senha não conta (uma senha com o ref não faz da homologação a produção, nem o contrário).
    expect(ehProducao(`postgresql://postgres.outro:${ref}@h.pooler.supabase.com:5432/postgres`, ref)).toBe(false);
  });
});

describe('conexão sem a URL na linha de comando', () => {
  it('a URL vira variáveis PG*; a senha nunca vai nos argumentos', () => {
    const env = ambientePg('postgresql://postgres.abc:s%40nha@aws-0.pooler.supabase.com:5432/postgres?sslmode=require');
    expect(env).toMatchObject({ PGHOST: 'aws-0.pooler.supabase.com', PGPORT: '5432', PGUSER: 'postgres.abc', PGPASSWORD: 's@nha', PGDATABASE: 'postgres', PGSSLMODE: 'require' });
  });

  it('ocultar troca a senha e a chave por ***', () => {
    expect(ocultar('falhou: senha s3gr3d0 e chave AbC=', ['s3gr3d0', 'AbC=', ''])).toBe('falhou: senha *** e chave ***');
  });
});
