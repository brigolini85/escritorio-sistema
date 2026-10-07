import { describe, expect, it } from 'vitest';
import { ehRotaPublica } from './rotas-publicas';

describe('ehRotaPublica', () => {
  it.each(['/entrar', '/auth/confirm', '/definir-senha', '/esqueci-senha', '/entrar/', '/esqueci-senha/'])('%s é pública', (c) => {
    expect(ehRotaPublica(c)).toBe(true);
  });
  it.each(['/entrar-x', '/entrarx', '/entrar/outra', '/auth/confirmar', '/auth/confirm/x', '/auth', '/definir-senha-admin',
    '/esqueci-senhas', '/', '/inicio', '/api/entrar', '//entrar', '/ENTRAR'])('%s não é pública', (c) => {
    expect(ehRotaPublica(c)).toBe(false);
  });
});
