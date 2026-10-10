import { beforeEach, describe, expect, it, vi } from 'vitest';

// Auditoria 2.3: limite próprio de tentativas (IP de quem pede, e-mail, pessoa), contado no banco.
vi.mock('server-only', () => ({}));
const falso = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({ rpc: falso.rpc }) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
import { dentroDosLimites, devolverTentativas, ipDe, LIMITES } from './limite-tentativas';

const JANELA = '2026-10-09T12:00:00+00:00';

beforeEach(() => {
  falso.rpc.mockReset();
  falso.rpc.mockResolvedValue({ data: JANELA, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ipDe', () => {
  // Revisão: o primeiro valor é o que o cliente mandou (forjável); o proxy acrescenta o IP real no fim.
  it('o último valor do x-forwarded-for (o que o proxy do Easypanel acrescentou), não o que o cliente mandou', () => {
    expect(ipDe(new Headers({ 'x-forwarded-for': ' 1.2.3.4 , 200.1.2.3' }))).toBe('200.1.2.3');
    expect(ipDe(new Headers({ 'x-forwarded-for': '200.1.2.3' }))).toBe('200.1.2.3');
  });
  it('com PAINEL_PROXIES_CONFIAVEIS=2 (um CDN na frente), o segundo da direita', () => {
    expect(ipDe(new Headers({ 'x-forwarded-for': '1.2.3.4, 200.1.2.3, 172.16.0.9' }), '2')).toBe('200.1.2.3');
  });
  it('menos valores que proxies: o mais à esquerda; valor inválido da variável vale 1', () => {
    expect(ipDe(new Headers({ 'x-forwarded-for': '200.1.2.3' }), '3')).toBe('200.1.2.3');
    expect(ipDe(new Headers({ 'x-forwarded-for': '1.2.3.4, 200.1.2.3' }), 'abc')).toBe('200.1.2.3');
    expect(ipDe(new Headers({ 'x-forwarded-for': '1.2.3.4, 200.1.2.3' }), '0')).toBe('200.1.2.3');
  });
  it('sem x-forwarded-for: x-real-ip; sem nada: um valor fixo', () => {
    expect(ipDe(new Headers({ 'x-real-ip': '200.9.9.9' }))).toBe('200.9.9.9');
    expect(ipDe(new Headers())).toBe('sem-ip');
  });
});

describe('limites', () => {
  it('os valores combinados', () => {
    expect(LIMITES.loginIpMinuto).toMatchObject({ limite: 5, janelaSegundos: 60 });
    expect(LIMITES.loginIpHora).toMatchObject({ limite: 20, janelaSegundos: 3600 });
    expect(LIMITES.loginEmail).toMatchObject({ limite: 5, janelaSegundos: 900 });
    expect(LIMITES.esqueciEmail).toMatchObject({ limite: 3, janelaSegundos: 3600 });
    expect(LIMITES.esqueciIp).toMatchObject({ limite: 10, janelaSegundos: 3600 });
    expect(LIMITES.fatorUsuario).toMatchObject({ limite: 5, janelaSegundos: 60 });
  });
});

describe('dentroDosLimites', () => {
  it('chave com o tipo e resumida: não guarda IP nem e-mail em claro; e-mail sem maiúsculas', async () => {
    await dentroDosLimites([[LIMITES.loginEmail, ' Ana@X.com ']]);
    const [nome, args] = falso.rpc.mock.calls[0]!;
    expect(nome).toBe('contar_tentativa_janela');
    expect(args.p_chave).toMatch(/^login-email:[0-9a-f]{64}$/);
    expect(args.p_chave).not.toContain('ana');
    expect(args).toMatchObject({ p_limite: 5, p_janela_segundos: 900 });
    falso.rpc.mockClear();
    await dentroDosLimites([[LIMITES.loginEmail, 'ana@x.com']]);
    expect(falso.rpc.mock.calls[0]![1].p_chave).toBe(args.p_chave);
  });
  it('devolve as chaves contadas (para o acerto devolver depois)', async () => {
    const r = await dentroDosLimites([[LIMITES.loginIpMinuto, '1.1.1.1'], [LIMITES.loginEmail, 'a@b.c']]);
    expect(r.ok).toBe(true);
    expect(r.contadas).toEqual([
      { chave: expect.stringMatching(/^login-ip-min:/), janela: JANELA },
      { chave: expect.stringMatching(/^login-email:/), janela: JANELA },
    ]);
  });
  it('para na primeira regra recusada', async () => {
    falso.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect((await dentroDosLimites([[LIMITES.loginIpMinuto, '1.1.1.1'], [LIMITES.loginEmail, 'a@b.c']])).ok).toBe(false);
    expect(falso.rpc).toHaveBeenCalledTimes(1);
  });
  it('banco fora: deixa passar (o Auth decide) e registra; nada contado para devolver', async () => {
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
    expect(await dentroDosLimites([[LIMITES.loginIpMinuto, '1.1.1.1']])).toEqual({ ok: true, contadas: [] });
    falso.rpc.mockRejectedValue(new Error('fetch failed'));
    expect((await dentroDosLimites([[LIMITES.loginIpMinuto, '1.1.1.1']])).ok).toBe(true);
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});

describe('devolverTentativas', () => {
  // Revisão final (T12): devolve na janela da contagem (a do banco), não na de agora.
  it('chama devolver_tentativa para cada chave contada, na janela em que ela foi contada', async () => {
    falso.rpc.mockResolvedValue({ data: null, error: null });
    await devolverTentativas([{ chave: 'login-ip-min:x', janela: '2026-10-09T11:59:00+00:00' }, { chave: 'login-email:y', janela: JANELA }]);
    expect(falso.rpc).toHaveBeenCalledWith('devolver_tentativa', { p_chave: 'login-ip-min:x', p_janela: '2026-10-09T11:59:00+00:00' });
    expect(falso.rpc).toHaveBeenCalledWith('devolver_tentativa', { p_chave: 'login-email:y', p_janela: JANELA });
  });
  it('falha não lança (o login já deu certo); só registra', async () => {
    falso.rpc.mockResolvedValueOnce({ data: null, error: { message: 'fora' } }).mockRejectedValueOnce(new Error('fetch failed'));
    await expect(devolverTentativas([{ chave: 'a', janela: JANELA }, { chave: 'b', janela: JANELA }])).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
