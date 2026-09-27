import { describe, expect, it } from 'vitest';
import { normalizarTelefone, variantesTelefone } from '../src/telefone';

describe('normalizarTelefone', () => {
  it('acrescenta 55 a número com DDD', () => {
    expect(normalizarTelefone('(31) 99999-0001')).toBe('5531999990001');
    expect(normalizarTelefone('31 3333-0001')).toBe('553133330001');
  });
  it('mantém número já com 55', () => {
    expect(normalizarTelefone('+55 31 99999-0001')).toBe('5531999990001');
  });
  it('recusa números inválidos', () => {
    expect(normalizarTelefone('12345')).toBeNull();
    expect(normalizarTelefone('')).toBeNull();
  });
});

describe('variantesTelefone', () => {
  it('celular com nono dígito gera também a versão sem ele', () => {
    expect(variantesTelefone('5531999990001')).toEqual(['5531999990001', '553199990001']);
  });
  it('celular sem nono dígito gera também a versão com ele', () => {
    expect(variantesTelefone('553199990001')).toEqual(['553199990001', '5531999990001']);
  });
  it('fixo não gera variante', () => {
    expect(variantesTelefone('553133330001')).toEqual(['553133330001']);
  });
});
