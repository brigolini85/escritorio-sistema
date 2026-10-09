import { beforeEach, describe, expect, it, vi } from 'vitest';

// Auditoria 2.6: /definir-senha é pública para o fluxo do link; com sessão de login comum, a troca pede a senha atual.
const MIN = 60 * 1000;
const token = (corpo: object) => `cab.${Buffer.from(JSON.stringify(corpo)).toString('base64url')}.ass`;
const falso = vi.hoisted(() => ({
  updateUser: vi.fn(),
  confere: vi.fn(),
  usuario: { id: 'u1', email: 'ana@x.com' } as { id: string; email: string } | null,
  amr: [] as { method: string; timestamp: number }[],
  contagem: new Map<string, number>(),
}));
vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: (u: string) => { throw new Error(`REDIRECT:${u}`); } }));
vi.mock('next/headers', () => ({ headers: async () => new Headers({ 'x-forwarded-for': '200.1.1.1' }) }));
vi.mock('@/lib/senha-atual', () => ({ senhaAtualConfere: falso.confere }));
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
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    auth: {
      getUser: async () => ({ data: { user: falso.usuario }, error: null }),
      getSession: async () => ({ data: { session: { access_token: token({ session_id: 's1', amr: falso.amr }) } } }),
      updateUser: falso.updateUser,
    },
  }),
}));
import { definirSenha } from './acoes';

const form = (campos: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(campos)) f.set(k, v); return f; };
const ha = (ms: number) => Math.floor((Date.now() - ms) / 1000);

beforeEach(() => {
  falso.updateUser.mockReset();
  falso.updateUser.mockResolvedValue({ error: null });
  falso.confere.mockReset();
  falso.confere.mockResolvedValue(true);
  falso.usuario = { id: 'u1', email: 'ana@x.com' };
  falso.contagem.clear();
});

describe('definirSenha', () => {
  it('sessão aberta pelo link (otp) há menos de 15 min: troca sem pedir a senha atual', async () => {
    falso.amr = [{ method: 'otp', timestamp: ha(2 * MIN) }];
    await expect(definirSenha(form({ senha: 'Senha-nova-2026' }))).rejects.toThrow('REDIRECT:/inicio');
    expect(falso.updateUser).toHaveBeenCalledWith({ password: 'Senha-nova-2026' });
    expect(falso.confere).not.toHaveBeenCalled();
  });
  it('link + segundo fator (amr com totp e otp): continua valendo', async () => {
    falso.amr = [{ method: 'totp', timestamp: ha(MIN) }, { method: 'otp', timestamp: ha(3 * MIN) }];
    await expect(definirSenha(form({ senha: 'Senha-nova-2026' }))).rejects.toThrow('REDIRECT:/inicio');
    expect(falso.updateUser).toHaveBeenCalled();
  });
  it('sessão de login comum, sem a senha atual: recusa sem trocar', async () => {
    falso.amr = [{ method: 'password', timestamp: ha(2 * MIN) }];
    await expect(definirSenha(form({ senha: 'Senha-nova-2026' }))).rejects.toThrow('REDIRECT:/definir-senha?erro=atual');
    expect(falso.updateUser).not.toHaveBeenCalled();
  });
  // Revisão (M1): quem veio do link não tem senha atual para digitar; link vencido manda pedir outro.
  it('link de mais de 15 min: recusa e manda pedir outro link (sem pedir a senha atual)', async () => {
    falso.amr = [{ method: 'otp', timestamp: ha(16 * MIN) }];
    await expect(definirSenha(form({ senha: 'Senha-nova-2026', senha_atual: 'qualquer' }))).rejects.toThrow('REDIRECT:/definir-senha?erro=link_vencido');
    expect(falso.updateUser).not.toHaveBeenCalled();
    expect(falso.confere).not.toHaveBeenCalled();
  });
  it('reautenticação pedida pelo Supabase (secure_password_change): explica e não diz "falha"', async () => {
    falso.amr = [{ method: 'password', timestamp: ha(2 * MIN) }];
    falso.updateUser.mockResolvedValue({ error: { code: 'reauthentication_needed', message: 'Password update requires reauthentication' } });
    await expect(definirSenha(form({ senha: 'Senha-nova-2026', senha_atual: 'senha-forte-123' }))).rejects.toThrow('REDIRECT:/definir-senha?erro=reautenticar');
  });
  it('sessão de login comum com a senha atual errada: recusa sem trocar', async () => {
    falso.amr = [{ method: 'password', timestamp: ha(2 * MIN) }];
    falso.confere.mockResolvedValue(false);
    await expect(definirSenha(form({ senha: 'Senha-nova-2026', senha_atual: 'errada-123' }))).rejects.toThrow('REDIRECT:/definir-senha?erro=atual_errada');
    expect(falso.confere).toHaveBeenCalledWith('ana@x.com', 'errada-123');
    expect(falso.updateUser).not.toHaveBeenCalled();
  });
  it('sessão de login comum com a senha atual certa: troca', async () => {
    falso.amr = [{ method: 'password', timestamp: ha(2 * MIN) }];
    await expect(definirSenha(form({ senha: 'Senha-nova-2026', senha_atual: 'senha-forte-123' }))).rejects.toThrow('REDIRECT:/inicio');
    expect(falso.updateUser).toHaveBeenCalledWith({ password: 'Senha-nova-2026' });
  });
  it('conferir a senha atual entra no limite do e-mail (5 em 15 min)', async () => {
    falso.amr = [{ method: 'password', timestamp: ha(2 * MIN) }];
    falso.confere.mockResolvedValue(false);
    for (let i = 0; i < 5; i++) await expect(definirSenha(form({ senha: 'Senha-nova-2026', senha_atual: 'x' }))).rejects.toThrow('erro=atual_errada');
    await expect(definirSenha(form({ senha: 'Senha-nova-2026', senha_atual: 'x' }))).rejects.toThrow('REDIRECT:/definir-senha?erro=tentativas');
    expect(falso.confere).toHaveBeenCalledTimes(5);
  });
  it('sem sessão: link vencido', async () => {
    falso.usuario = null;
    await expect(definirSenha(form({ senha: 'Senha-nova-2026' }))).rejects.toThrow('REDIRECT:/entrar?erro=link');
    expect(falso.updateUser).not.toHaveBeenCalled();
  });
  it('com o aplicativo cadastrado e só aal1: pede o código antes (como antes)', async () => {
    falso.amr = [{ method: 'otp', timestamp: ha(MIN) }];
    falso.updateUser.mockResolvedValue({ error: { code: 'insufficient_aal', message: 'AAL2 required' } });
    await expect(definirSenha(form({ senha: 'Senha-nova-2026' }))).rejects.toThrow('REDIRECT:/segundo-fator?depois=senha');
  });
  it('senha curta: nem confere a sessão', async () => {
    await expect(definirSenha(form({ senha: 'curta' }))).rejects.toThrow('REDIRECT:/definir-senha?erro=curta');
  });
});
