import { beforeEach, describe, expect, it, vi } from 'vitest';

// Segurança do login (item 8): o código do aplicativo é conferido pelo Supabase; erro fica na tela (o QR não muda).
const falso = vi.hoisted(() => ({ challengeAndVerify: vi.fn(), listFactors: vi.fn(), rpc: vi.fn(), usuario: 'u1', contagem: new Map<string, number>() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
// Dublê de contar_tentativa_janela: a mesma regra do banco, em memória (devolve a janela; nulo acima do limite).
vi.mock('@/lib/supabase/servico', () => ({
  supabaseServico: () => ({
    rpc: async (nome: string, a: { p_chave: string; p_limite: number }) => {
      const n = falso.contagem.get(a.p_chave) ?? 0;
      if (nome === 'devolver_tentativa') {
        falso.contagem.set(a.p_chave, Math.max(n - 1, 0));
        return { data: null, error: null };
      }
      if (n >= a.p_limite) return { data: null, error: null };
      falso.contagem.set(a.p_chave, n + 1);
      return { data: '2026-10-09T12:00:00+00:00', error: null };
    },
  }),
}));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    auth: {
      getUser: async () => ({ data: { user: falso.usuario ? { id: falso.usuario } : null }, error: null }),
      mfa: { challengeAndVerify: falso.challengeAndVerify, listFactors: falso.listFactors },
    },
    rpc: falso.rpc,
  }),
}));
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));
import { cadastrarAplicativo, conferirCodigo } from './acoes';

const form = (campos: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(campos)) f.set(k, v); return f; };

beforeEach(() => {
  falso.contagem.clear();
  falso.usuario = 'u1';
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

// Auditoria 2.3: código do segundo fator, 5 por minuto por pessoa, antes do Auth.
describe('limite de tentativas do código', () => {
  it('a 6ª tentativa no minuto é recusada sem chamar o Auth; outra pessoa passa', async () => {
    falso.challengeAndVerify.mockResolvedValue({ error: { message: 'Invalid TOTP code entered' } });
    for (let i = 0; i < 5; i++) expect((await conferirCodigo({ erro: null }, form({ codigo: '123456' }))).erro).toContain('Código incorreto');
    expect(await conferirCodigo({ erro: null }, form({ codigo: '123456' }))).toEqual({ erro: 'Muitas tentativas. Espere alguns minutos e tente de novo.' });
    expect(falso.challengeAndVerify).toHaveBeenCalledTimes(5);
    falso.usuario = 'u2';
    expect((await conferirCodigo({ erro: null }, form({ codigo: '123456' }))).erro).toContain('Código incorreto');
    expect(falso.challengeAndVerify).toHaveBeenCalledTimes(6);
  });
  // Revisão: código certo devolve a tentativa (quem entra e sai várias vezes no minuto não fica trancado).
  it('códigos certos devolvem a tentativa: 7 no mesmo minuto passam todos', async () => {
    for (let i = 0; i < 7; i++) await expect(conferirCodigo({ erro: null }, form({ codigo: '123456' }))).rejects.toThrow('REDIRECT:/inicio');
    expect(falso.challengeAndVerify).toHaveBeenCalledTimes(7);
  });
  it('sem sessão: volta para a entrada', async () => {
    falso.usuario = '';
    await expect(cadastrarAplicativo({ erro: null }, form({ fator: 'f1', codigo: '123456' }))).rejects.toThrow('REDIRECT:/entrar');
    expect(falso.challengeAndVerify).not.toHaveBeenCalled();
  });
});
