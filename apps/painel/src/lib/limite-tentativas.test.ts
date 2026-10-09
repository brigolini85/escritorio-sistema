import { beforeEach, describe, expect, it, vi } from 'vitest';

// Auditoria 2.3: limite próprio de tentativas (IP de quem pede, e-mail, pessoa), contado no banco.
vi.mock('server-only', () => ({}));
const falso = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({ rpc: falso.rpc }) }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
import { dentroDosLimites, ipDe, LIMITES } from './limite-tentativas';

beforeEach(() => {
  falso.rpc.mockReset();
  falso.rpc.mockResolvedValue({ data: true, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ipDe', () => {
  it('primeiro valor do x-forwarded-for (o proxy do Easypanel acrescenta os seguintes)', () => {
    expect(ipDe(new Headers({ 'x-forwarded-for': ' 200.1.2.3 , 10.0.0.1' }))).toBe('200.1.2.3');
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
    expect(nome).toBe('contar_tentativa');
    expect(args.p_chave).toMatch(/^login-email:[0-9a-f]{64}$/);
    expect(args.p_chave).not.toContain('ana');
    expect(args).toMatchObject({ p_limite: 5, p_janela_segundos: 900 });
    falso.rpc.mockClear();
    await dentroDosLimites([[LIMITES.loginEmail, 'ana@x.com']]);
    expect(falso.rpc.mock.calls[0]![1].p_chave).toBe(args.p_chave);
  });
  it('para na primeira regra recusada', async () => {
    falso.rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await dentroDosLimites([[LIMITES.loginIpMinuto, '1.1.1.1'], [LIMITES.loginEmail, 'a@b.c']])).toBe(false);
    expect(falso.rpc).toHaveBeenCalledTimes(1);
  });
  it('banco fora: deixa passar (o Auth decide) e registra', async () => {
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'connection refused' } });
    expect(await dentroDosLimites([[LIMITES.loginIpMinuto, '1.1.1.1']])).toBe(true);
    falso.rpc.mockRejectedValue(new Error('fetch failed'));
    expect(await dentroDosLimites([[LIMITES.loginIpMinuto, '1.1.1.1']])).toBe(true);
    expect(console.error).toHaveBeenCalledTimes(2);
  });
});
