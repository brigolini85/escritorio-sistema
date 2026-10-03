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

describe('fila sugerir_resposta (Atendimento)', () => {
  it('existe com o nome que o painel usa: a mesma sugestão enfileirada duas vezes vira um job só', async () => {
    expect(FILAS.sugerirResposta).toBe('sugerir_resposta');
    await boss.purgeQueue(FILAS.sugerirResposta);
    const id = crypto.randomUUID();
    await boss.send(FILAS.sugerirResposta, { sugestaoId: id }, { singletonKey: id });
    await boss.send(FILAS.sugerirResposta, { sugestaoId: id }, { singletonKey: id });
    expect(await boss.getQueueSize(FILAS.sugerirResposta)).toBe(1);
    await boss.purgeQueue(FILAS.sugerirResposta);
  });
});

describe('fila simular_agente (Treinar o agente)', () => {
  it('existe com o nome que o painel usa e recebe { simulacaoId }', async () => {
    expect(FILAS.simularAgente).toBe('simular_agente');
    await boss.purgeQueue(FILAS.simularAgente);
    const id = crypto.randomUUID();
    await agendarSimulacao(filaDe(boss), id);
    // O mesmo teste enfileirado de novo (clique duplo, reenvio) não vira um segundo job.
    await agendarSimulacao(filaDe(boss), id);
    expect(await boss.getQueueSize(FILAS.simularAgente)).toBe(1);
    const [job] = await boss.fetch<{ simulacaoId: string }>(FILAS.simularAgente);
    expect(job!.data).toEqual({ simulacaoId: id });
  });
});
