import { randomBytes } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { cifrar, cofreConfigurado, contextoAcesso, decifrar, ErroCofre, FORMATO_CIFRADO } from './cofre';

const CHAVE = randomBytes(32).toString('base64');

beforeEach(() => {
  vi.stubEnv('ACESSOS_PORTAIS_CHAVE', CHAVE);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('cofre dos acessos de portais (D1)', () => {
  it('cifra no formato que o banco aceita e decifra de volta', () => {
    const c = cifrar('Portal#Segredo-2026', contextoAcesso('cli-1'));
    expect(c).toMatch(FORMATO_CIFRADO);
    expect(c).not.toContain('Segredo');
    expect(decifrar(c, contextoAcesso('cli-1'))).toBe('Portal#Segredo-2026');
  });

  it('a mesma senha sai diferente a cada vez', () => {
    expect(cifrar('a', 'x')).not.toBe(cifrar('a', 'x'));
  });

  it('a cifra de uma empresa não abre em outra', () => {
    const c = cifrar('segredo', contextoAcesso('cli-1'));
    expect(() => decifrar(c, contextoAcesso('cli-2'))).toThrow(ErroCofre);
  });

  it('cifra mexida não abre', () => {
    const partes = cifrar('segredo', 'x').split('.');
    partes[3] = (partes[3]!.startsWith('A') ? 'B' : 'A') + partes[3]!.slice(1);
    expect(() => decifrar(partes.join('.'), 'x')).toThrow(ErroCofre);
  });

  it('outra chave não abre', () => {
    const c = cifrar('segredo', 'x');
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', randomBytes(32).toString('base64'));
    expect(() => decifrar(c, 'x')).toThrow(ErroCofre);
  });

  it('sem chave, ou com tamanho errado, o cofre fica desligado (D8)', () => {
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', '');
    expect(cofreConfigurado()).toBe(false);
    expect(() => cifrar('a', 'x')).toThrow(ErroCofre);
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', Buffer.from('curta').toString('base64'));
    expect(cofreConfigurado()).toBe(false);
  });

  it('a mensagem de erro nunca leva a senha', () => {
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', '');
    expect(() => cifrar('Portal#Segredo-2026', 'x')).toThrow(/^(?!.*Segredo).*$/);
  });
});
