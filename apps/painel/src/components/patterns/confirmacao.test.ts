import { describe, expect, it } from 'vitest';
import { textoConfere } from './confirmacao';

describe('textoConfere', () => {
  it('ignora espaços extras e maiúsculas', () => {
    expect(textoConfere('  joão   lima ', 'João Lima')).toBe(true);
  });
  it('acento e nome diferente não confirmam', () => {
    expect(textoConfere('Joao Lima', 'João Lima')).toBe(false);
    expect(textoConfere('João', 'João Lima')).toBe(false);
  });
  it('esperado vazio nunca confirma', () => {
    expect(textoConfere('', '')).toBe(false);
    expect(textoConfere(' ', '  ')).toBe(false);
  });
});
