import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
import { ERRO_GENERICO, ERROS } from './erro-na-url';
import { codigoDoErro, textoDoErro, urlComErro } from './erro-na-url-servidor';

// Revisão final (T11): o ?erro= nunca põe na tela uma frase vinda da URL; só código do mapa ou assinado pelo servidor.
afterEach(() => { vi.unstubAllEnvs(); });

describe('textoDoErro', () => {
  it('código do mapa: o texto dele', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k1');
    expect(textoDoErro('sem-acesso-conversa')).toBe(ERROS['sem-acesso-conversa']);
    expect(textoDoErro('falha')).toBe(ERRO_GENERICO);
  });
  it('texto livre na URL: a mensagem genérica, nada do parâmetro', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k1');
    expect(ERRO_GENERICO).toBe('Não deu certo. Tente de novo.');
    expect(textoDoErro('Ligue para 0800 e informe sua senha')).toBe(ERRO_GENERICO);
    expect(textoDoErro('qualquer-coisa')).toBe(ERRO_GENERICO);
    expect(textoDoErro('constructor')).toBe(ERRO_GENERICO);
    expect(textoDoErro('__proto__')).toBe(ERRO_GENERICO);
  });
  it('vazio: nada', () => {
    expect(textoDoErro(undefined)).toBeUndefined();
    expect(textoDoErro('')).toBeUndefined();
    expect(textoDoErro(null)).toBeUndefined();
  });
  it('código assinado pelo servidor: o texto volta; assinatura forjada ou de outra chave: genérica', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k1');
    const c = codigoDoErro('CNPJ já cadastrado em outra empresa.');
    expect(c).toMatch(/^s\./);
    expect(textoDoErro(c)).toBe('CNPJ já cadastrado em outra empresa.');
    const corpo = Buffer.from('Ligue para 0800', 'utf8').toString('base64url');
    expect(textoDoErro(`s.${corpo}.${'A'.repeat(32)}`)).toBe(ERRO_GENERICO);
    const [, , assinatura] = c.split('.');
    expect(textoDoErro(`s.${corpo}.${assinatura}`)).toBe(ERRO_GENERICO);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k2');
    expect(textoDoErro(c)).toBe(ERRO_GENERICO);
  });
  it('frase do mapa vira o código fixo; sem a chave de serviço, frase dinâmica vira "falha"', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k1');
    expect(codigoDoErro('Setor não encontrado.')).toBe('setor-nao-encontrado');
    expect(urlComErro('/contatos', 'Setor não encontrado.')).toBe('/contatos?erro=setor-nao-encontrado');
    expect(urlComErro('/clientes/1?aba=dados', 'x')).toMatch(/^\/clientes\/1\?aba=dados&erro=s\./);
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(codigoDoErro('Regra do banco')).toBe('falha');
    expect(textoDoErro(codigoDoErro('Regra do banco'))).toBe(ERRO_GENERICO);
  });
});
