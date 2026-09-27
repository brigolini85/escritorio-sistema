import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type PgBoss from 'pg-boss';
import { FILAS, agendarProcessamento, criarBoss, filaDe } from '../src/fila';

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
