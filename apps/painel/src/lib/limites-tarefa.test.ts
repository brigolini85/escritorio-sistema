import { afterEach, describe, expect, it, vi } from 'vitest';
import { algumPodePedir } from './tarefas-tela';

vi.mock('server-only', () => ({}));
const { lerLimitesTarefa } = await import('./agentes');

const sbCom = (r: { data: unknown; error: { code?: string; message: string } | null }) =>
  ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => r }) }) }) }) as unknown as Parameters<typeof lerLimitesTarefa>[0];

afterEach(() => vi.restoreAllMocks());

describe('botão da tarefa (D3)', () => {
  it('só aparece quando algum agente aceita o pedido', () => {
    expect(algumPodePedir([])).toBe(false);
    expect(algumPodePedir([{ podePedir: false }, { podePedir: false }])).toBe(false);
    expect(algumPodePedir([{ podePedir: false }, { podePedir: true }])).toBe(true);
  });
});

describe('limites da tarefa', () => {
  it('lê os limites', async () => {
    expect(await lerLimitesTarefa(sbCom({ data: { tarefa_limite_usd: '2.5', tarefa_limite_minutos: 30 }, error: null }), 'fiscal')).toEqual({ usd: 2.5, minutos: 30 });
  });
  it('banco sem a I3: null e sem log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await lerLimitesTarefa(sbCom({ data: null, error: { code: '42703', message: 'x' } }), 'fiscal')).toBeNull();
    expect(log).not.toHaveBeenCalled();
  });
  it('erro real: registra no log e devolve "erro"', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await lerLimitesTarefa(sbCom({ data: null, error: { code: '57014', message: 'timeout' } }), 'fiscal')).toBe('erro');
    expect(log).toHaveBeenCalledTimes(1);
  });
});
