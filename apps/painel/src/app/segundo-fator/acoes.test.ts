import { beforeEach, describe, expect, it, vi } from 'vitest';

// Segurança do login (item 8): o código do aplicativo é conferido pelo Supabase; erro fica na tela (o QR não muda).
const falso = vi.hoisted(() => ({ challengeAndVerify: vi.fn(), listFactors: vi.fn(), rpc: vi.fn() }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    auth: { mfa: { challengeAndVerify: falso.challengeAndVerify, listFactors: falso.listFactors } },
    rpc: falso.rpc,
  }),
}));
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));
import { cadastrarAplicativo, conferirCodigo } from './acoes';

const form = (campos: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(campos)) f.set(k, v); return f; };

beforeEach(() => {
  falso.challengeAndVerify.mockReset();
  falso.challengeAndVerify.mockResolvedValue({ error: null });
  falso.listFactors.mockReset();
  falso.listFactors.mockResolvedValue({ data: { totp: [{ id: 'fator-verificado', status: 'verified' }] }, error: null });
  falso.rpc.mockReset();
  falso.rpc.mockResolvedValue({ data: 1, error: null });
});

describe('cadastrarAplicativo', () => {
  it('código certo: confirma o fator que está na tela e entra', async () => {
    await expect(cadastrarAplicativo({ erro: null }, form({ fator: 'f1', codigo: '123 456' }))).rejects.toThrow('REDIRECT:/inicio');
    expect(falso.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' });
  });
  // Auditoria 2.5: o primeiro cadastro do aplicativo vira aviso ao dono.
  it('código certo: registra o cadastro do aplicativo (aviso ao dono)', async () => {
    await expect(cadastrarAplicativo({ erro: null }, form({ fator: 'f1', codigo: '123456' }))).rejects.toThrow('REDIRECT:/inicio');
    expect(falso.rpc).toHaveBeenCalledWith('registrar_fator_cadastrado');
  });
  it('o registro falhou: a pessoa entra mesmo assim', async () => {
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'falhou' } });
    await expect(cadastrarAplicativo({ erro: null }, form({ fator: 'f1', codigo: '123456' }))).rejects.toThrow('REDIRECT:/inicio');
  });
  it('código errado: mensagem e nada de redirecionar', async () => {
    falso.challengeAndVerify.mockResolvedValue({ error: { message: 'Invalid TOTP code entered' } });
    expect(await cadastrarAplicativo({ erro: null }, form({ fator: 'f1', codigo: '123456' })))
      .toEqual({ erro: 'Código incorreto ou vencido. Confira se a hora do celular está certa e digite o código novo.' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });
  it('código fora do formato: nem chama o Supabase', async () => {
    expect(await cadastrarAplicativo({ erro: null }, form({ fator: 'f1', codigo: '12' }))).toEqual({ erro: 'Digite os 6 números que aparecem no aplicativo.' });
    expect(falso.challengeAndVerify).not.toHaveBeenCalled();
  });
});

describe('conferirCodigo', () => {
  it('usa o fator já cadastrado (nunca um id vindo do formulário) e respeita o destino fixo', async () => {
    await expect(conferirCodigo({ erro: null }, form({ fator: 'outro', codigo: '654321', depois: 'senha' }))).rejects.toThrow('REDIRECT:/definir-senha');
    expect(falso.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'fator-verificado', code: '654321' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });
  it('sem fator cadastrado: volta para a tela, que mostra o cadastro', async () => {
    falso.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
    await expect(conferirCodigo({ erro: null }, form({ codigo: '654321' }))).rejects.toThrow('REDIRECT:/segundo-fator');
  });
});
