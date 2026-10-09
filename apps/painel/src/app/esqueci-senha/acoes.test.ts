import { beforeEach, describe, expect, it, vi } from 'vitest';

// Segurança do login (item 4): o endereço do link vem de PAINEL_URL, nunca do cabeçalho Origin de quem pede.
vi.mock('server-only', () => ({}));
const falso = vi.hoisted(() => ({ ip: '200.1.1.1', contagem: new Map<string, number>() }));
const resetPasswordForEmail = vi.fn();
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ auth: { resetPasswordForEmail } }) }));
// Dublê de contar_tentativa: a mesma regra do banco, em memória.
vi.mock('@/lib/supabase/servico', () => ({
  supabaseServico: () => ({
    rpc: async (nome: string, a: { p_chave: string; p_limite: number }) => {
      const n = falso.contagem.get(a.p_chave) ?? 0;
      if (nome === 'devolver_tentativa') {
        falso.contagem.set(a.p_chave, Math.max(n - 1, 0));
        return { data: null, error: null };
      }
      if (n >= a.p_limite) return { data: false, error: null };
      falso.contagem.set(a.p_chave, n + 1);
      return { data: true, error: null };
    },
  }),
}));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'https://malicioso.example', 'x-forwarded-for': `9.9.9.9, ${falso.ip}` }) }));
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));
import { pedirNovaSenha } from './acoes';

const form = (email: string) => { const f = new FormData(); f.set('email', email); return f; };

beforeEach(() => {
  resetPasswordForEmail.mockReset();
  resetPasswordForEmail.mockResolvedValue({ error: null });
  falso.contagem.clear();
  falso.ip = '200.1.1.1';
  vi.stubEnv('PAINEL_URL', 'https://painel.escritorio.test');
});

describe('pedirNovaSenha', () => {
  it('usa PAINEL_URL no redirectTo, mesmo com Origin de outro site', async () => {
    await expect(pedirNovaSenha(form('ana@x.com'))).rejects.toThrow('REDIRECT:/esqueci-senha?enviado=1');
    expect(resetPasswordForEmail).toHaveBeenCalledWith('ana@x.com', { redirectTo: 'https://painel.escritorio.test/auth/confirm' });
  });
  it('PAINEL_URL inválido: não manda e-mail com endereço quebrado e avisa a falha', async () => {
    vi.stubEnv('PAINEL_URL', '');
    await expect(pedirNovaSenha(form('ana@x.com'))).rejects.toThrow('REDIRECT:/esqueci-senha?erro=envio');
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });
});

// Auditoria 2.3: o limite de e-mails do projeto acabava com pedidos repetidos; agora 3 por hora por e-mail e 10 por IP.
describe('pedirNovaSenha: limite de tentativas', () => {
  it('o mesmo e-mail 4 vezes: a 4ª é recusada sem chamar o Auth', async () => {
    for (let i = 0; i < 3; i++) {
      falso.ip = `200.5.5.${i}`;
      await expect(pedirNovaSenha(form('ana@x.com'))).rejects.toThrow('REDIRECT:/esqueci-senha?enviado=1');
    }
    falso.ip = '200.5.5.9';
    await expect(pedirNovaSenha(form('Ana@x.com'))).rejects.toThrow('REDIRECT:/esqueci-senha?erro=tentativas');
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(3);
  });
  it('10 por hora do mesmo IP, com e-mails diferentes', async () => {
    for (let i = 0; i < 10; i++) await expect(pedirNovaSenha(form(`p${i}@x.com`))).rejects.toThrow('REDIRECT:/esqueci-senha?enviado=1');
    await expect(pedirNovaSenha(form('p11@x.com'))).rejects.toThrow('REDIRECT:/esqueci-senha?erro=tentativas');
    expect(resetPasswordForEmail).toHaveBeenCalledTimes(10);
  });
});
