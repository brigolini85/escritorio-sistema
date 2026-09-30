import { describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  criados: 0,
  start: vi.fn<() => Promise<void>>(),
  send: vi.fn(async () => 'job-1'),
}));
vi.mock('server-only', () => ({}));
vi.mock('pg-boss', () => ({
  default: class {
    constructor() { falso.criados++; }
    on() {}
    start() { return falso.start(); }
    async createQueue() {}
    send(...a: unknown[]) { return (falso.send as (...x: unknown[]) => Promise<string>)(...a); }
  },
}));

import { enfileirarEnvio } from './fila';

describe('fila do painel (revisão final, E4)', () => {
  it('se a conexão falhar, a próxima chamada tenta de novo em vez de repetir o erro', async () => {
    falso.start.mockRejectedValueOnce(new Error('banco fora do ar')).mockResolvedValue(undefined);
    await expect(enfileirarEnvio('m1')).rejects.toThrow('banco fora do ar');
    await enfileirarEnvio('m2');
    expect(falso.criados).toBe(2);
    expect(falso.send).toHaveBeenCalledWith('enviar-mensagem', { mensagemId: 'm2' });
    // Conectado: a conexão é reaproveitada.
    await enfileirarEnvio('m3');
    expect(falso.criados).toBe(2);
  });
});
