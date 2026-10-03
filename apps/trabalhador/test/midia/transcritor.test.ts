import { describe, expect, it, vi } from 'vitest';
import { criarTranscritor, VOCABULARIO_PADRAO } from '../../src/midia/transcritor';

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
