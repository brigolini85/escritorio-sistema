import { beforeEach, describe, expect, it, vi } from 'vitest';

// Segurança do login (item 8): o cadastro do aplicativo só para quem precisa, limpando os que ficaram pela metade.
const f = vi.hoisted(() => ({ exige: true, fatores: [] as { id: string; factor_type: string; status: string }[], unenroll: vi.fn(), enroll: vi.fn() }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } } }),
      mfa: {
        listFactors: async () => ({ data: { all: f.fatores, totp: f.fatores.filter((x) => x.status === 'verified') }, error: null }),
        unenroll: f.unenroll, enroll: f.enroll,
      },
    },
    rpc: async () => ({ data: f.exige, error: null }),
  }),
}));
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));
import { prepararCadastro } from './acoes';

beforeEach(() => {
  Object.assign(f, { exige: true, fatores: [] });
  f.unenroll.mockReset().mockResolvedValue({ error: null });
  f.enroll.mockReset().mockResolvedValue({ data: { id: 'novo', totp: { qr_code: 'data:image/svg+xml;x', secret: 'ABCD' } }, error: null });
});

describe('prepararCadastro', () => {
  it('apaga os cadastros pela metade e devolve QR e chave', async () => {
    f.fatores = [{ id: 'velho', factor_type: 'totp', status: 'unverified' }];
    expect(await prepararCadastro()).toEqual({ ok: true, fator: 'novo', qr: 'data:image/svg+xml;x', segredo: 'ABCD' });
    expect(f.unenroll).toHaveBeenCalledWith({ factorId: 'velho' });
  });
  it('quem já tem o aplicativo não cadastra outro por aqui', async () => {
    f.fatores = [{ id: 'ok', factor_type: 'totp', status: 'verified' }];
    await expect(prepararCadastro()).rejects.toThrow('REDIRECT:/segundo-fator');
    expect(f.enroll).not.toHaveBeenCalled();
  });
  it('quem não precisa vai para o início', async () => {
    f.exige = false;
    await expect(prepararCadastro()).rejects.toThrow('REDIRECT:/inicio');
  });
  it('falha do Supabase: mensagem em português', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    f.enroll.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await prepararCadastro()).toMatchObject({ ok: false });
  });
});
