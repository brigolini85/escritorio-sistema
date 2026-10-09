import { describe, expect, it } from 'vitest';
import { opcoesCookieSupabase } from './opcoes-cookie';

// Auditoria 2.2: os cookies sb-* saíam sem Secure e por 400 dias.
describe('opcoesCookieSupabase', () => {
  it('produção e homologação: Secure e SameSite=Lax', () => {
    for (const a of ['producao', 'homologacao']) expect(opcoesCookieSupabase(a)).toMatchObject({ secure: true, sameSite: 'lax', path: '/' });
  });
  it('sem AMBIENTE: Secure (na dúvida, o mais seguro)', () => {
    expect(opcoesCookieSupabase(undefined).secure).toBe(true);
  });
  it('local (e2e em http): sem Secure, ainda Lax', () => {
    expect(opcoesCookieSupabase('local')).toMatchObject({ secure: false, sameSite: 'lax' });
  });
  it('dura no máximo as 12 h da sessão', () => {
    expect(opcoesCookieSupabase('producao').maxAge).toBe(12 * 60 * 60);
  });
});
