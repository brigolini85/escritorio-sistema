import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { lerPainelUrl } from './ambiente-servidor';

describe('lerPainelUrl (item 4)', () => {
  it('aceita http(s) sem caminho e tira a barra final', () => {
    expect(lerPainelUrl({ PAINEL_URL: 'https://painel.escritorio.com.br/' })).toBe('https://painel.escritorio.com.br');
    expect(lerPainelUrl({ PAINEL_URL: 'http://localhost:3002' })).toBe('http://localhost:3002');
  });
  it.each([undefined, '', '   ', 'painel.com', 'javascript:alert(1)', 'ftp://painel.com', 'https://painel.com/caminho', 'https://painel.com?x=1',
    'https://user:senha@painel.com'])('recusa %s com o nome da variável', (v) => {
    expect(() => lerPainelUrl({ PAINEL_URL: v })).toThrow(/PAINEL_URL/);
  });
  it('em produção, http só para localhost (homologação no computador do dono)', () => {
    expect(lerPainelUrl({ PAINEL_URL: 'http://127.0.0.1:3002', NODE_ENV: 'production' })).toBe('http://127.0.0.1:3002');
    expect(() => lerPainelUrl({ PAINEL_URL: 'http://painel.com', NODE_ENV: 'production' })).toThrow(/https/);
  });
});
