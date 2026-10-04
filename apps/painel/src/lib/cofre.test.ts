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

  it('a chave só vale em base64 estrito de 32 bytes (44 letras terminando em "=")', () => {
    const k = randomBytes(32);
    for (const ruim of [
      k.toString('base64url'), // 43 letras, sem "=" e com "-"/"_": o Node aceitaria
      k.toString('base64').slice(0, 43), // sem o "="
      `${k.toString('base64').slice(0, 20)}*${k.toString('base64').slice(21)}`, // letra fora do base64, que o Node pularia
      `${k.toString('base64')}AAAA`, // 35 bytes
      ` ${k.toString('base64').slice(0, 22)} ${k.toString('base64').slice(22)}`, // espaço no meio
    ]) {
      vi.stubEnv('ACESSOS_PORTAIS_CHAVE', ruim);
      expect(cofreConfigurado(), ruim).toBe(false);
    }
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', `${k.toString('base64')}\n`);
    expect(cofreConfigurado()).toBe(true);
  });

  it('a mensagem de erro nunca leva a senha', () => {
    vi.stubEnv('ACESSOS_PORTAIS_CHAVE', '');
    expect(() => cifrar('Portal#Segredo-2026', 'x')).toThrow(/^(?!.*Segredo).*$/);
  });
});
