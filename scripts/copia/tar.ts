// Auditoria 6.2: um .tar (ustar) mínimo, em fluxo, só com arquivos comuns. Os nomes são nossos (manifesto.json, banco/…,
// objetos/000001): curtos e sem caracteres especiais. O leitor recusa qualquer nome que pudesse escrever fora da pasta.
import { createReadStream } from 'node:fs';
import { mkdir, open, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const BLOCO = 512;
const NOME_SEGURO = /^[a-z0-9_-]+(\.[a-z0-9]+)?(\/[a-z0-9_-]+(\.[a-z0-9]+)?)*$/;

function conferirNome(nome: string): void {
  if (nome.length > 100 || !NOME_SEGURO.test(nome)) throw new Error(`Cópia com nome recusado no pacote: ${JSON.stringify(nome.slice(0, 120))}`);
}

function cabecalho(nome: string, tamanho: number): Buffer {
  const b = Buffer.alloc(BLOCO);
  b.write(nome, 0, 'ascii');
  b.write('0000644\0', 100, 'ascii');
  b.write('0000000\0', 108, 'ascii');
  b.write('0000000\0', 116, 'ascii');
  b.write(tamanho.toString(8).padStart(11, '0') + '\0', 124, 'ascii');
  b.write(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 'ascii');
  b.write('        ', 148, 'ascii');
  b.write('0', 156, 'ascii');
  b.write('ustar\0', 257, 'ascii');
  b.write('00', 263, 'ascii');
  let soma = 0;
  for (const x of b) soma += x;
  b.write(soma.toString(8).padStart(6, '0') + '\0 ', 148, 'ascii');
  return b;
}

/** Gera o .tar dos arquivos `nomes` (relativos a `pasta`), em pedaços. */
export async function* gerarTar(pasta: string, nomes: string[]): AsyncGenerator<Buffer> {
  for (const nome of nomes) {
    conferirNome(nome);
    const caminho = join(pasta, nome);
    const { size } = await stat(caminho);
    yield cabecalho(nome, size);
    for await (const pedaco of createReadStream(caminho)) yield pedaco as Buffer;
    const resto = size % BLOCO;
    if (resto) yield Buffer.alloc(BLOCO - resto);
  }
  yield Buffer.alloc(BLOCO * 2);
}

function lerOctal(b: Buffer, inicio: number, tamanho: number): number {
  const texto = b.subarray(inicio, inicio + tamanho).toString('ascii').replace(/\0.*$/s, '').trim();
  if (!/^[0-7]*$/.test(texto)) throw new Error('Pacote da cópia corrompido (número inválido no cabeçalho).');
  return texto ? parseInt(texto, 8) : 0;
}

/** Lê um .tar gerado por `gerarTar` e escreve os arquivos dentro de `destino`. */
export async function lerTar(fonte: AsyncIterable<Buffer>, destino: string): Promise<string[]> {
  await mkdir(destino, { recursive: true });
  const escritos: string[] = [];
  let buf: Buffer = Buffer.alloc(0);
  let atual: { arquivo: Awaited<ReturnType<typeof open>>; falta: number; preenchimento: number } | null = null;
  let fim = false;
  try {
    for await (const pedaco of fonte) {
      buf = buf.length ? Buffer.concat([buf, pedaco]) : pedaco;
      while (!fim) {
        if (atual) {
          if (atual.falta > 0) {
            if (buf.length === 0) break;
            const parte = buf.subarray(0, Math.min(atual.falta, buf.length));
            await atual.arquivo.write(parte);
            atual.falta -= parte.length;
            buf = buf.subarray(parte.length);
            continue;
          }
          if (buf.length < atual.preenchimento) break;
          buf = buf.subarray(atual.preenchimento);
          await atual.arquivo.close();
          atual = null;
          continue;
        }
        if (buf.length < BLOCO) break;
        const cab = buf.subarray(0, BLOCO);
        buf = buf.subarray(BLOCO);
        if (cab.every((x) => x === 0)) { fim = true; break; }
        const guardada = lerOctal(cab, 148, 8);
        let soma = 0;
        for (let i = 0; i < BLOCO; i++) soma += i >= 148 && i < 156 ? 32 : cab[i]!;
        if (soma !== guardada) throw new Error('Pacote da cópia corrompido (cabeçalho inválido).');
        const nome = cab.subarray(0, 100).toString('ascii').replace(/\0.*$/s, '');
        conferirNome(nome);
        if (cab.toString('ascii', 156, 157) !== '0') throw new Error(`Pacote da cópia com entrada que não é arquivo: ${nome}`);
        const tamanho = lerOctal(cab, 124, 12);
        const caminho = join(destino, nome);
        await mkdir(dirname(caminho), { recursive: true });
        atual = { arquivo: await open(caminho, 'wx'), falta: tamanho, preenchimento: (BLOCO - (tamanho % BLOCO)) % BLOCO };
        escritos.push(nome);
      }
    }
  } finally {
    if (atual) await atual.arquivo.close();
  }
  if (!fim || atual) throw new Error('Pacote da cópia incompleto.');
  return escritos;
}
