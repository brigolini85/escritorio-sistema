import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type PgBoss from 'pg-boss';
import { FILAS, agendarProcessamento, agendarSimulacao, criarBoss, filaDe } from '../src/fila';

let boss: PgBoss;
beforeAll(async () => { boss = await criarBoss(process.env.DATABASE_URL!); });
afterAll(async () => { await boss.stop({ graceful: false }); });

describe('agrupamento de mensagens picadas', () => {
  it('três mensagens seguidas da mesma conversa geram um único processamento pendente', async () => {
    await boss.purgeQueue(FILAS.processarConversa);
    const fila = filaDe(boss);
    const id = crypto.randomUUID();
    await agendarProcessamento(fila, id);
    await agendarProcessamento(fila, id);
    await agendarProcessamento(fila, id);
    await agendarProcessamento(fila, crypto.randomUUID());
    expect(await boss.getQueueSize(FILAS.processarConversa)).toBe(2);
  });
});

describe('fila simular_agente (Treinar o agente)', () => {
  it('existe com o nome que o painel usa e recebe { simulacaoId }', async () => {
    expect(FILAS.simularAgente).toBe('simular_agente');
    await boss.purgeQueue(FILAS.simularAgente);
    const id = crypto.randomUUID();
    await agendarSimulacao(filaDe(boss), id);
    const [job] = await boss.fetch<{ simulacaoId: string }>(FILAS.simularAgente);
    expect(job!.data).toEqual({ simulacaoId: id });
  });
});
