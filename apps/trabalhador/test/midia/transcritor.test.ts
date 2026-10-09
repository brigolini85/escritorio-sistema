import { describe, expect, it, vi } from 'vitest';
import { audioLongoDemais, cortarTranscricao, criarTranscritor, duracaoOpusSegundos, VOCABULARIO_PADRAO } from '../../src/midia/transcritor';

/** Uma página Ogg: "OggS", versão, tipo, posição (amostras a 48 kHz, int64 LE), série, sequência, CRC, segmentos e o conteúdo. */
function paginaOgg(posicao: bigint, conteudo: Uint8Array): Uint8Array {
  const p = new Uint8Array(27 + 1 + conteudo.length);
  p.set([0x4f, 0x67, 0x67, 0x53]);
  new DataView(p.buffer).setBigInt64(6, posicao, true);
  p[26] = 1;
  p[27] = conteudo.length;
  p.set(conteudo, 28);
  return p;
}
const opusDe = (segundos: number) => {
  const cabecalho = paginaOgg(0n, new TextEncoder().encode('OpusHead\x01\x01'));
  const ultima = paginaOgg(BigInt(segundos * 48_000), new Uint8Array(10));
  const a = new Uint8Array(cabecalho.length + 50 + ultima.length);
  a.set(cabecalho);
  a.set(ultima, cabecalho.length + 50);
  return a;
};

describe('limites do áudio (auditoria 5.7)', () => {
  it('lê a duração do cabeçalho Ogg Opus (a última página diz até onde vai o áudio)', () => {
    expect(duracaoOpusSegundos(opusDe(700))).toBe(700);
    expect(duracaoOpusSegundos(new Uint8Array([1, 2, 3]))).toBeNull();
  });
  it('mais de 10 min pelo cabeçalho, ou mais de 10 MB sem cabeçalho, é longo demais', () => {
    expect(audioLongoDemais(opusDe(601))).toBe(true);
    expect(audioLongoDemais(opusDe(599))).toBe(false);
    expect(audioLongoDemais(new Uint8Array(10 * 1024 * 1024 + 1))).toBe(true);
    expect(audioLongoDemais(new Uint8Array(1024))).toBe(false);
  });
  it('transcrição acima de 4.000 caracteres é cortada com o aviso', () => {
    expect(cortarTranscricao('curta')).toBe('curta');
    expect(cortarTranscricao('x'.repeat(4001))).toBe(`${'x'.repeat(4000)} [áudio longo: transcrição cortada]`);
  });
});

describe('transcritor', () => {
  it('envia o áudio em multipart, em português, e devolve o texto', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: ' Preciso do DAS. ' })));
    const t = criarTranscritor({ baseUrl: 'https://api.exemplo/v1', apiKey: 'K', modelo: 'whisper' }, buscar);
    expect(await t.transcrever(new Uint8Array([1, 2]), 'audio/ogg', 'a.ogg')).toEqual({ texto: 'Preciso do DAS.', segundos: null });
    const [url, init] = buscar.mock.calls[0]!;
    expect(url).toBe('https://api.exemplo/v1/audio/transcriptions');
    expect(init.headers.Authorization).toBe('Bearer K');
    const form = init.body as FormData;
    expect(form.get('model')).toBe('whisper');
    expect(form.get('language')).toBe('pt');
    expect(form.get('prompt')).toBe(VOCABULARIO_PADRAO);
  });
  it('pede verbose_json e devolve o texto e a duração em segundos', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: ' Preciso do DAS. ', duration: 12.48 })));
    const t = criarTranscritor({ baseUrl: 'https://api.exemplo/v1', apiKey: 'K', modelo: 'whisper' }, buscar);
    expect(await t.transcrever(new Uint8Array([1, 2]), 'audio/ogg', 'a.ogg')).toEqual({ texto: 'Preciso do DAS.', segundos: 12.48 });
    expect((buscar.mock.calls[0]![1].body as FormData).get('response_format')).toBe('verbose_json');
    expect(t.modelo).toBe('whisper');
    expect(t.provedor).toBe('groq');
  });
  it('sem duração na resposta: segundos nulos (custo 0, a tela avisa)', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'ok' })));
    const t = criarTranscritor({ baseUrl: 'https://x', apiKey: 'K', modelo: 'm' }, buscar);
    expect(await t.transcrever(new Uint8Array([1]), 'audio/ogg', 'a.ogg')).toEqual({ texto: 'ok', segundos: null });
  });
  it('usa o vocabulário configurado no lugar do padrão', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: 'ok' })));
    const t = criarTranscritor({ baseUrl: 'https://x', apiKey: 'K', modelo: 'm', vocabulario: 'DAS, DIRPF' }, buscar);
    await t.transcrever(new Uint8Array([1]), 'audio/ogg', 'a.ogg');
    expect((buscar.mock.calls[0]![1].body as FormData).get('prompt')).toBe('DAS, DIRPF');
  });
  it('erro do fornecedor vira exceção', async () => {
    const buscar = vi.fn().mockResolvedValue(new Response('x', { status: 429 }));
    const t = criarTranscritor({ baseUrl: 'https://x', apiKey: 'K', modelo: 'm' }, buscar);
    await expect(t.transcrever(new Uint8Array([1]), 'audio/ogg', 'a.ogg')).rejects.toThrow('transcrição falhou: 429');
  });
});
