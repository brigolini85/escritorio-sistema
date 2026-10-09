// Auditoria 3.5: o download só vai a hosts da Z-API, por https, sem IP literal e sem redirecionar para fora.
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@escritorio/db';
import { criarArmazenamento, hostPermitido } from '../../src/midia/armazenamento';

const db = { storage: { from: () => ({ upload: async () => ({ error: null }) }) } } as unknown as Db;
const ok = () => new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'audio/ogg' } });
const baixar = (url: string, f: unknown) => criarArmazenamento(db, f as typeof fetch).baixarESalvar(url, 'c1', 'a.ogg', null);

describe('hostPermitido', () => {
  it.each([
    ['https://f004.backblazeb2.com/file/a.ogg', true],
    ['https://api.z-api.io/x', true],
    ['https://storage.googleapis.com/b/a.ogg', true],
    ['https://z-api.io.atacante.com/a', false],
    ['https://notz-api.io/a', false],
    ['http://f004.backblazeb2.com/a', false],
    ['http://169.254.169.254/latest', false],
    ['https://169.254.169.254/latest', false],
    ['https://[::1]/a', false],
    ['https://localhost/a', false],
    ['https://exemplo.com/a.pdf', false],
    ['nao-e-url', false],
  ])('%s -> %s', (url, esperado) => { expect(hostPermitido(url)).toBe(esperado); });

  it('a lista é configurável', () => {
    expect(hostPermitido('https://exemplo.com/a', ['exemplo.com'])).toBe(true);
  });
});

describe('baixarESalvar', () => {
  it('URL interna ou de host fora da lista: recusa sem chamar fetch', async () => {
    for (const u of ['http://169.254.169.254/x', 'https://exemplo.com/a.pdf', 'https://127.0.0.1/a']) {
      const f = vi.fn();
      await expect(baixar(u, f)).rejects.toThrow(/não permitid/);
      expect(f).not.toHaveBeenCalled();
    }
  });
  it('host permitido baixa, sem seguir redirecionamento automático', async () => {
    const f = vi.fn().mockResolvedValue(ok());
    await expect(baixar('https://f004.backblazeb2.com/file/a.ogg', f)).resolves.toMatchObject({ mime: 'audio/ogg' });
    expect(f.mock.calls[0]![1]).toMatchObject({ redirect: 'manual' });
  });
  it('redirecionamento para fora da lista: recusa', async () => {
    const f = vi.fn().mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1:3001/x' } }));
    await expect(baixar('https://f004.backblazeb2.com/a', f)).rejects.toThrow(/não permitid/);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('redirecionamento dentro da lista é seguido, no máximo 3 saltos', async () => {
    const salto = (n: number) => new Response(null, { status: 302, headers: { location: `https://storage.googleapis.com/${n}` } });
    const f = vi.fn().mockResolvedValueOnce(salto(1)).mockResolvedValueOnce(salto(2)).mockResolvedValueOnce(ok());
    await expect(baixar('https://f004.backblazeb2.com/a', f)).resolves.toBeTruthy();
    const g = vi.fn().mockImplementation(async () => salto(9));
    await expect(baixar('https://f004.backblazeb2.com/a', g)).rejects.toThrow(/redirecion/);
    expect(g).toHaveBeenCalledTimes(4);
  });
});
