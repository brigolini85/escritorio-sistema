import { describe, expect, it } from 'vitest';
import { somenteDigitos, validarCnpj } from '../src/documentos';

describe('validarCnpj', () => {
  it('aceita CNPJ válido com ou sem máscara', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true);
    expect(validarCnpj('11222333000181')).toBe(true);
  });
  it('recusa dígito verificador errado e sequências repetidas', () => {
    expect(validarCnpj('11222333000182')).toBe(false);
    expect(validarCnpj('11111111111111')).toBe(false);
  });
  it('somenteDigitos', () => {
    expect(somenteDigitos('11.222.333/0001-81')).toBe('11222333000181');
  });
});
