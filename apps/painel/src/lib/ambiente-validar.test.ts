import { describe, expect, it } from 'vitest';
import { problemasDoAmbiente } from './ambiente-validar';

// Segurança do login (item 5): o painel não sobe com variável faltando ou trocada.
const jwt = (role: string) => `x.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.y`;
const BOM = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
  NEXT_PUBLIC_SUPABASE_CHAVE_PUBLICA: jwt('anon'),
  SUPABASE_SERVICE_ROLE_KEY: jwt('service_role'),
  PAINEL_URL: 'http://localhost:3000',
  AMBIENTE: 'local',
};
const SEGREDO = 'a'.repeat(32);

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
    // Auditoria 3.13: AMBIENTE passou a ser conferido (eram 4).
    expect(problemasDoAmbiente({})).toHaveLength(5);
  });
  it('auditoria 3.13: AMBIENTE só producao, homologacao ou local (NEXT_PUBLIC_AMBIENTE vale na falta dele)', () => {
    // Auditoria 2.7: fora do computador local o segredo do cookie de atividade passou a ser obrigatório.
    for (const v of ['producao', 'homologacao', 'local']) expect(problemasDoAmbiente({ ...BOM, AMBIENTE: v, PAINEL_SEGREDO_SESSAO: SEGREDO })).toEqual([]);
    expect(problemasDoAmbiente({ ...BOM, AMBIENTE: undefined, NEXT_PUBLIC_AMBIENTE: 'homologacao', PAINEL_SEGREDO_SESSAO: SEGREDO })).toEqual([]);
    const p = problemasDoAmbiente({ ...BOM, AMBIENTE: 'prod' });
    expect(p).toHaveLength(1);
    expect(p[0]).toContain('AMBIENTE');
    expect(p[0]).toContain('producao, homologacao ou local');
  });
  // Auditoria 2.7: o cookie de atividade tinha a chave de serviço como segredo.
  it('auditoria 2.7: PAINEL_SEGREDO_SESSAO obrigatório em produção e homologação, com pelo menos 32 caracteres', () => {
    for (const v of ['producao', 'homologacao']) {
      const p = problemasDoAmbiente({ ...BOM, AMBIENTE: v });
      expect(p).toHaveLength(1);
      expect(p[0]).toContain('PAINEL_SEGREDO_SESSAO');
      expect(problemasDoAmbiente({ ...BOM, AMBIENTE: v, PAINEL_SEGREDO_SESSAO: 'curto' })[0]).toContain('32');
    }
    expect(problemasDoAmbiente({ ...BOM, AMBIENTE: 'producao', PAINEL_SEGREDO_SESSAO: 'x'.repeat(32) })).toEqual([]);
  });
  it('auditoria 2.7: no computador local pode faltar (o painel sorteia um por processo); curto demais não', () => {
    expect(problemasDoAmbiente({ ...BOM, AMBIENTE: 'local' })).toEqual([]);
    expect(problemasDoAmbiente({ ...BOM, AMBIENTE: 'local', PAINEL_SEGREDO_SESSAO: 'curto' })[0]).toContain('PAINEL_SEGREDO_SESSAO');
  });
  it('a mensagem nunca mostra o valor do segredo', () => {
    expect(problemasDoAmbiente({ ...BOM, AMBIENTE: 'producao', PAINEL_SEGREDO_SESSAO: 'valor-secreto' }).join(' ')).not.toContain('valor-secreto');
  });
});
