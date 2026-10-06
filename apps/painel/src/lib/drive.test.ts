import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { lerDriveDaTarefa, lerGuarda, lerPastaDoCliente, lerSituacaoDrive } = await import('./drive');

const sbCom = (r: { data?: unknown; error?: { code: string; message: string } | null }) => ({
  from: () => { const q: Record<string, unknown> = {}; for (const m of ['select', 'eq']) q[m] = () => q; q.then = (ok: (v: unknown) => unknown) => ok({ data: null, error: null, ...r }); return q; },
}) as never;
const REAL = { code: '08006', message: 'conexão caiu' };
const SEM = { code: '42P01', message: 'não existe' };

describe('leituras do Drive (erro real não vira vazio)', () => {
  it('erro real: estado de erro, sem valor', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await lerPastaDoCliente(sbCom({ error: REAL }), 'c')).toEqual({ semI3b: false, erro: true, pasta: null });
    expect(await lerSituacaoDrive(sbCom({ error: REAL }))).toEqual({ semI3b: false, erro: true, situacao: null });
    expect(await lerGuarda(sbCom({ error: REAL }))).toEqual({ semI3b: false, erro: true, dias: null });
  });
  it('sem migração: semI3b, sem erro', async () => {
    expect(await lerPastaDoCliente(sbCom({ error: SEM }), 'c')).toEqual({ semI3b: true, erro: false, pasta: null });
    expect(await lerGuarda(sbCom({ error: SEM }))).toEqual({ semI3b: true, erro: false, dias: null });
  });
  it('leitura boa devolve o valor', async () => {
    expect(await lerPastaDoCliente(sbCom({ data: [{ drive_pasta_id: 'abc' }] }), 'c')).toEqual({ semI3b: false, erro: false, pasta: 'abc' });
    expect(await lerGuarda(sbCom({ data: [{ dias: 365 }] }))).toEqual({ semI3b: false, erro: false, dias: 365 });
  });
});

describe('lerDriveDaTarefa (revisão final, minor 1)', () => {
  it('erro real ao ler a pasta ou a situação vai como erro; sem cliente não lê pasta; sem migração é null', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await lerDriveDaTarefa(sbCom({ error: REAL }), 'c')).toEqual({ pasta: null, situacao: null, erro: true });
    expect(await lerDriveDaTarefa(sbCom({ error: SEM }), 'c')).toBeNull();
    expect(await lerDriveDaTarefa(sbCom({ data: [] }), null)).toEqual({ pasta: null, situacao: null });
  });
});
