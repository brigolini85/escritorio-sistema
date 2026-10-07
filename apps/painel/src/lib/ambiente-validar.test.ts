import { describe, expect, it } from 'vitest';
import { problemasDoAmbiente } from './ambiente-validar';

// Segurança do login (item 5): o painel não sobe com variável faltando ou trocada.
const jwt = (role: string) => `x.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.y`;
const BOM = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA: jwt('anon'),
  SUPABASE_SERVICE_ROLE_KEY: jwt('service_role'),
  PAINEL_URL: 'http://localhost:3000',
};

describe('problemasDoAmbiente', () => {
  it('tudo certo: nenhum problema', () => {
    expect(problemasDoAmbiente(BOM)).toEqual([]);
    expect(problemasDoAmbiente({ ...BOM, NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA: 'sb_publishable_abc', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_abc' })).toEqual([]);
  });
  it.each(Object.keys(BOM))('sem %s: o problema cita a variável', (nome) => {
    const p = problemasDoAmbiente({ ...BOM, [nome]: undefined });
    expect(p).toHaveLength(1);
    expect(p[0]).toContain(nome);
  });
  it('URL do Supabase fora do formato ou http fora do computador local em produção', () => {
    expect(problemasDoAmbiente({ ...BOM, NEXT_PUBLIC_SUPABASE_URL: 'supabase.co' })[0]).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(problemasDoAmbiente({ ...BOM, NEXT_PUBLIC_SUPABASE_URL: 'http://abc.supabase.co', NODE_ENV: 'production' })[0]).toContain('https');
    expect(problemasDoAmbiente({ ...BOM, NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co', NODE_ENV: 'production' })).toEqual([]);
  });
  it('chave de serviço no lugar da pública (iria para o navegador): recusa', () => {
    expect(problemasDoAmbiente({ ...BOM, NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA: jwt('service_role') })[0]).toContain('chave de serviço');
    expect(problemasDoAmbiente({ ...BOM, NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA: 'sb_secret_abc' })[0]).toContain('chave de serviço');
  });
  it('variável NEXT_PUBLIC_ com a chave de serviço: recusa', () => {
    expect(problemasDoAmbiente({ ...BOM, NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'x' })[0]).toContain('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY');
  });
  it('vários problemas de uma vez', () => {
    expect(problemasDoAmbiente({})).toHaveLength(4);
  });
});
