import { describe, expect, it } from 'vitest';
import { caminhoDaEmpresa, somenteDigitos, validarCnpj } from '../src/documentos';

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

describe('caminhoDaEmpresa (auditoria 1.3 e 6.10)', () => {
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  it('aceita só arquivo na pasta da própria empresa', () => {
    expect(caminhoDaEmpresa(a, `clientes/${a}/1700000000-contrato.pdf`)).toBe(true);
    expect(caminhoDaEmpresa(a, `clientes/${b}/contrato.pdf`)).toBe(false);
    expect(caminhoDaEmpresa(a, `clientes/${a}x/contrato.pdf`)).toBe(false);
    expect(caminhoDaEmpresa(a, `${a}/contrato.pdf`)).toBe(false);
    expect(caminhoDaEmpresa(a, `clientes/${a}/../${b}/contrato.pdf`)).toBe(false);
    expect(caminhoDaEmpresa('', 'clientes//contrato.pdf')).toBe(false);
  });
});
