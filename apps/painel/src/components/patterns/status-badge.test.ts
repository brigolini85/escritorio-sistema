import { describe, expect, it } from 'vitest';
import { STATUS_DEMANDA } from './status-badge';

describe('status de demanda em texto com ponto (spec 4.2)', () => {
  it('cada status tem rótulo e cor de texto, nunca só cor', () => {
    expect(Object.fromEntries(Object.entries(STATUS_DEMANDA).map(([k, v]) => [k, [v.rotulo, v.cor]]))).toEqual({
      aberto: ['Aberta', 'text-info'],
      em_andamento: ['Em andamento', 'text-brand'],
      aguardando_cliente: ['Aguardando cliente', 'text-warning'],
      concluido: ['Concluída', 'text-success'],
    });
  });
});
