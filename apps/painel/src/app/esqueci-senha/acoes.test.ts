import { beforeEach, describe, expect, it, vi } from 'vitest';

// Segurança do login (item 4): o endereço do link vem de PAINEL_URL, nunca do cabeçalho Origin de quem pede.
vi.mock('server-only', () => ({}));
const resetPasswordForEmail = vi.fn();
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ auth: { resetPasswordForEmail } }) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ origin: 'https://malicioso.example' }) }));
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));
import { pedirNovaSenha } from './acoes';

const form = (email: string) => { const f = new FormData(); f.set('email', email); return f; };

beforeEach(() => {
  resetPasswordForEmail.mockReset();
  resetPasswordForEmail.mockResolvedValue({ error: null });
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
