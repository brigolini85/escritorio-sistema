import { beforeEach, describe, expect, it, vi } from 'vitest';

// Login com o Supabase falso: erro na situação de acesso não diz "desativado" nem desloga quem pode estar ativo.
const falso = vi.hoisted(() => ({
  rpc: vi.fn(),
  signOut: vi.fn(),
  cookies: { set: vi.fn(), delete: vi.fn() },
  signIn: vi.fn(),
  ip: '200.1.1.1',
  // Dublê de contar_tentativa: a mesma regra do banco, em memória.
  contagem: new Map<string, number>(),
}));
vi.mock('server-only', () => ({}));
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
vi.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); } }));
vi.mock('next/headers', () => ({
  cookies: async () => falso.cookies,
  // O primeiro valor é o que o cliente mandou (forjável); o proxy acrescenta o IP real no fim.
  headers: async () => new Headers({ 'x-forwarded-for': `9.9.9.9, ${falso.ip}` }),
}));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    auth: {
      signInWithPassword: falso.signIn,
      signOut: falso.signOut,
    },
    rpc: falso.rpc,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { tamanho_letra: null }, error: null }) }) }) }),
  }),
}));

import { entrar } from './acoes';

const form = (email = 'a@b.c') => {
  const f = new FormData();
  f.append('email', email);
  f.append('senha', 'x');
  return f;
};

beforeEach(() => {
  falso.rpc.mockReset();
  falso.signOut.mockReset();
  falso.signIn.mockReset();
  falso.signIn.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  falso.contagem.clear();
  falso.ip = '200.1.1.1';
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('entrar', () => {
  it('erro do banco na situação: mensagem própria, sem deslogar', async () => {
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'connection reset' } });
    await expect(entrar(form())).rejects.toThrow('REDIRECT /entrar?erro=indisponivel');
    expect(falso.signOut).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });
  it('arquivada: desloga e avisa acesso desativado', async () => {
    falso.rpc.mockResolvedValue({ data: { situacao: 'inativo' }, error: null });
    await expect(entrar(form())).rejects.toThrow('REDIRECT /entrar?erro=inativo');
    expect(falso.signOut).toHaveBeenCalled();
  });
  it('fora do horário: desloga e avisa o horário', async () => {
    falso.rpc.mockResolvedValue({ data: { situacao: 'fora_do_horario' }, error: null });
    await expect(entrar(form())).rejects.toThrow('REDIRECT /entrar?erro=fora_do_horario');
    expect(falso.signOut).toHaveBeenCalled();
  });
  it('liberado: entra', async () => {
    falso.rpc.mockResolvedValue({ data: { situacao: 'liberado' }, error: null });
    await expect(entrar(form())).rejects.toThrow('REDIRECT /inicio');
    expect(falso.signOut).not.toHaveBeenCalled();
  });
});

// Auditoria 2.3: limite próprio antes do Auth (para o Supabase, todo login sai do IP do painel).
describe('entrar: limite de tentativas', () => {
  const zerarMinuto = () => { for (const k of [...falso.contagem.keys()]) if (k.startsWith('login-ip-min:')) falso.contagem.delete(k); };
  beforeEach(() => {
    falso.signIn.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
  });
  it('a 6ª tentativa do mesmo IP no minuto é recusada sem chamar o Auth; outro IP passa', async () => {
    for (let i = 0; i < 5; i++) await expect(entrar(form(`p${i}@x.com`))).rejects.toThrow('REDIRECT /entrar?erro=credenciais');
    expect(falso.signIn).toHaveBeenCalledTimes(5);
    await expect(entrar(form('p6@x.com'))).rejects.toThrow('REDIRECT /entrar?erro=tentativas');
    expect(falso.signIn).toHaveBeenCalledTimes(5);
    falso.ip = '200.2.2.2';
    await expect(entrar(form('p7@x.com'))).rejects.toThrow('REDIRECT /entrar?erro=credenciais');
    expect(falso.signIn).toHaveBeenCalledTimes(6);
  });
  it('o mesmo e-mail de IPs diferentes: a 6ª em 15 min é recusada', async () => {
    for (let i = 0; i < 5; i++) {
      falso.ip = `200.3.3.${i}`;
      await expect(entrar(form('alvo@x.com'))).rejects.toThrow('REDIRECT /entrar?erro=credenciais');
    }
    falso.ip = '200.3.3.9';
    await expect(entrar(form('ALVO@x.com'))).rejects.toThrow('REDIRECT /entrar?erro=tentativas');
    expect(falso.signIn).toHaveBeenCalledTimes(5);
  });
  it('20 por hora do mesmo IP, mesmo com o minuto virando', async () => {
    for (let i = 0; i < 20; i++) {
      zerarMinuto();
      await expect(entrar(form(`h${i}@x.com`))).rejects.toThrow('REDIRECT /entrar?erro=credenciais');
    }
    zerarMinuto();
    await expect(entrar(form('h21@x.com'))).rejects.toThrow('REDIRECT /entrar?erro=tentativas');
    expect(falso.signIn).toHaveBeenCalledTimes(20);
  });
});

// Revisão (auditoria 2.3): o acerto devolve a tentativa; o escritório atrás de um IP só não fica trancado.
describe('entrar: login certo devolve a tentativa', () => {
  beforeEach(() => {
    falso.rpc.mockResolvedValue({ data: { situacao: 'liberado' }, error: null });
  });
  it('20 logins certos do mesmo IP na mesma hora (e no mesmo minuto) passam todos', async () => {
    for (let i = 0; i < 25; i++) await expect(entrar(form(`ok${i}@x.com`))).rejects.toThrow('REDIRECT /inicio');
    expect(falso.signIn).toHaveBeenCalledTimes(25);
  });
  it('5 erros e depois a senha certa: ainda recusado, sem chamar o Auth', async () => {
    falso.signIn.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    for (let i = 0; i < 5; i++) await expect(entrar(form('ana@x.com'))).rejects.toThrow('REDIRECT /entrar?erro=credenciais');
    falso.signIn.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    await expect(entrar(form('ana@x.com'))).rejects.toThrow('REDIRECT /entrar?erro=tentativas');
    expect(falso.signIn).toHaveBeenCalledTimes(5);
  });
  it('o acerto zera a parte dele: depois de 4 erros e um acerto, os 4 erros continuam contando', async () => {
    falso.signIn.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    for (let i = 0; i < 4; i++) await expect(entrar(form('bia@x.com'))).rejects.toThrow('erro=credenciais');
    falso.signIn.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    await expect(entrar(form('bia@x.com'))).rejects.toThrow('REDIRECT /inicio');
    falso.signIn.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    await expect(entrar(form('bia@x.com'))).rejects.toThrow('erro=credenciais');
    await expect(entrar(form('bia@x.com'))).rejects.toThrow('erro=tentativas');
  });
  it('o IP forjado no começo do x-forwarded-for não muda nada (vale o último valor)', async () => {
    falso.signIn.mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } });
    for (let i = 0; i < 5; i++) await expect(entrar(form(`f${i}@x.com`))).rejects.toThrow('erro=credenciais');
    await expect(entrar(form('f6@x.com'))).rejects.toThrow('erro=tentativas');
    expect(console.warn).toHaveBeenCalledWith('[entrar] muitas tentativas', { ip: '200.1.1.1' });
  });
});
