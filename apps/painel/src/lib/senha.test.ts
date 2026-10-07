import { describe, expect, it } from 'vitest';
import { SENHA_MINIMA, senhaCurta } from './senha';

describe('senhaCurta', () => {
  it('mínimo de 10 caracteres', () => {
    expect(SENHA_MINIMA).toBe(10);
    expect(senhaCurta('123456789')).toBe(true);
    expect(senhaCurta('1234567890')).toBe(false);
    expect(senhaCurta('')).toBe(true);
  });
});
