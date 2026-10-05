import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { lerUsoRegras, parteI2Aplicada } = await import('./agentes');
const rpc = (data: unknown, error: { code: string; message: string } | null) => ({ rpc: async () => ({ data, error }) });

describe('uso no mês das regras (D11, D15)', () => {
  it('regra → conversas', async () => {
    expect(await lerUsoRegras(rpc([{ regra_id: 'r1', conversas: 14 }, { regra_id: 'r2', conversas: '5' }], null) as never, 'fiscal', 'a', 'b'))
      .toEqual({ r1: 14, r2: 5 });
  });
  it('banco sem a I2: null (a tela mostra "—"), sem erro', async () => {
    expect(await lerUsoRegras(rpc(null, { code: 'PGRST202', message: 'função não existe' }) as never, 'fiscal', 'a', 'b')).toBeNull();
  });
  it('parteI2Aplicada: só a função ausente diz "não"', async () => {
    expect(await parteI2Aplicada(rpc(null, { code: '42883', message: 'não existe' }) as never)).toBe(false);
    expect(await parteI2Aplicada(rpc(null, { code: 'P0001', message: 'Você não tem acesso aos agentes.' }) as never)).toBe(true);
    expect(await parteI2Aplicada(rpc([], null) as never)).toBe(true);
  });
});
