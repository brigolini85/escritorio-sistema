import { describe, expect, it, vi } from 'vitest';
import { lerAgentePausado, lerGastoIaDoMes, lerSinaisVida } from './leituras-admin';

vi.mock('server-only', () => ({}));

/** Cliente falso: cada `await` da cadeia devolve a próxima resposta da lista. */
function falso(respostas: unknown[]) {
  const chamadas: unknown[][] = [];
  let i = 0;
  const cadeia: Record<string, unknown> = {};
  for (const m of ['select', 'eq']) cadeia[m] = (...a: unknown[]) => { chamadas.push([m, ...a]); return cadeia; };
  cadeia.maybeSingle = (...a: unknown[]) => { chamadas.push(['maybeSingle', ...a]); return Promise.resolve(respostas[i++]); };
  cadeia.then = (ok: (v: unknown) => unknown) => Promise.resolve(respostas[i++]).then(ok);
  return { sb: { from: (t: string) => { chamadas.push(['from', t]); return cadeia; } } as never, chamadas };
}

describe('lerGastoIaDoMes', () => {
  it('lê o total do mês pela gastos_resumo', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { total_usd: 41.2 }, error: null });
    expect(await lerGastoIaDoMes({ rpc } as never, new Date('2026-10-15T15:00:00Z'))).toEqual({ total: 41.2 });
    expect(rpc).toHaveBeenCalledWith('gastos_resumo', { p_de: '2026-10-01T00:00:00-03:00', p_ate: '2026-11-01T00:00:00-03:00' });
  });
  it('total em texto (numeric do PostgREST) vira número', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { total_usd: '12.5' }, error: null });
    expect(await lerGastoIaDoMes({ rpc } as never, new Date())).toEqual({ total: 12.5 });
  });
  it('quem não é administrador: null', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'Só o administrador vê os gastos com IA.' } });
    expect(await lerGastoIaDoMes({ rpc } as never, new Date())).toBeNull();
  });
});

describe('lerSinaisVida', () => {
  it('por componente, com o mais recente', async () => {
    const { sb } = falso([{ data: [{ componente: 'fila', visto_em: '2026-09-30T12:00:00Z' }, { componente: 'whatsapp', visto_em: '2026-09-30T11:00:00Z' }], error: null }]);
    expect(await lerSinaisVida(sb)).toEqual({ fila: '2026-09-30T12:00:00Z', whatsapp: '2026-09-30T11:00:00Z', ultimo: '2026-09-30T12:00:00Z' });
  });
});

describe('lerAgentePausado', () => {
  it('configuracoes.agente_pausado; sem leitura (RLS) vira null', async () => {
    const { sb, chamadas } = falso([{ data: { agente_pausado: true }, error: null }]);
    expect(await lerAgentePausado(sb)).toBe(true);
    expect(chamadas).toEqual([['from', 'configuracoes'], ['select', 'agente_pausado'], ['eq', 'id', 1], ['maybeSingle']]);
    expect(await lerAgentePausado(falso([{ data: null, error: null }]).sb)).toBeNull();
  });
});
