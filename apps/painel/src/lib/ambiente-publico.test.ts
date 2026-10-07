import { afterEach, describe, expect, it, vi } from 'vitest';
import { chavePublica, supabaseUrl } from './ambiente-publico';

afterEach(() => vi.unstubAllEnvs());

describe('leitores das variáveis públicas', () => {
  it('devolvem o valor', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA', 'chave');
    expect(supabaseUrl()).toBe('http://127.0.0.1:54321');
    expect(chavePublica()).toBe('chave');
  });
  it('vazias: erro claro com o nome (nunca "undefined" na URL)', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA', '');
    expect(() => supabaseUrl()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => chavePublica()).toThrow(/NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA/);
  });
});
