import { describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({ send: vi.fn(async () => 'job-1'), filas: new Map<string, unknown>() }));
vi.mock('server-only', () => ({}));
vi.mock('pg-boss', () => ({
  default: class {
    on() {}
    async start() {}
    async createQueue(nome: string, opcoes: unknown) { falso.filas.set(nome, opcoes); }
    send(...a: unknown[]) { return (falso.send as (...x: unknown[]) => Promise<string>)(...a); }
  },
}));
import { enfileirarPedidoPendencia, enfileirarTarefa } from './fila';

describe('filas das tarefas iguais às do trabalhador (D6, D7)', () => {
  it('agente_trabalho: uma vez por tarefa', async () => {
    await enfileirarTarefa('t1');
    expect(falso.filas.get('agente_trabalho')).toEqual({ name: 'agente_trabalho', policy: 'stately', retryLimit: 2, retryDelay: 30, retryBackoff: true, expireInSeconds: 1800 });
    expect(falso.send).toHaveBeenLastCalledWith('agente_trabalho', { tarefaId: 't1' }, { singletonKey: 't1' });
  });
  it('pendencia_cliente: chave pela pendência e pela vez do pedido', async () => {
    await enfileirarPedidoPendencia('p1', 2);
    expect(falso.filas.get('pendencia_cliente')).toEqual({ name: 'pendencia_cliente', policy: 'stately', retryLimit: 3, retryDelay: 30, retryBackoff: true });
    expect(falso.send).toHaveBeenLastCalledWith('pendencia_cliente', { pendenciaId: 'p1' }, { singletonKey: 'p1:2' });
  });
});
