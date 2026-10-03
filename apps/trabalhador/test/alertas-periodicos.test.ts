import { describe, expect, it } from 'vitest';
import { alertasPeriodicos, type DepsTarefas } from '../src/tarefas';

// Revisão final da Parte C: uma falha no alerta de fila não pode pular o de vencimento (nem o contrário).
const d = {} as DepsTarefas;

describe('alertasPeriodicos', () => {
  it('a primeira falha e a segunda ainda roda; o erro volta no fim', async () => {
    const rodou: string[] = [];
    const tarefas = [
      async () => { rodou.push('fila'); throw new Error('fila caiu'); },
      async () => { rodou.push('vencimento'); return 0; },
    ];
    await expect(alertasPeriodicos(d, tarefas)).rejects.toThrow('fila caiu');
    expect(rodou).toEqual(['fila', 'vencimento']);
  });
  it('as duas falham: as duas rodam e o erro diz as duas', async () => {
    const tarefas = [async () => { throw new Error('a'); }, async () => { throw new Error('b'); }];
    await expect(alertasPeriodicos(d, tarefas)).rejects.toThrow(/a.*b/s);
  });
  it('nenhuma falha: termina sem erro', async () => {
    await expect(alertasPeriodicos(d, [async () => 1, async () => 2])).resolves.toBeUndefined();
  });
});
