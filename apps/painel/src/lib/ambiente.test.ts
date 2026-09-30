import { describe, expect, it } from 'vitest';
import { rotuloAmbiente } from './ambiente';

describe('rotuloAmbiente', () => {
  it('sem variável mostra DESENVOLVIMENTO', () => {
    expect(rotuloAmbiente(undefined)).toBe('DESENVOLVIMENTO');
    expect(rotuloAmbiente('  ')).toBe('DESENVOLVIMENTO');
  });
  it('produção não mostra faixa', () => {
    expect(rotuloAmbiente('producao')).toBeNull();
    expect(rotuloAmbiente('Produção')).toBeNull();
  });
  it('homologação e outros valores aparecem em maiúsculas', () => {
    expect(rotuloAmbiente('homologacao')).toBe('HOMOLOGAÇÃO');
    expect(rotuloAmbiente('desenvolvimento')).toBe('DESENVOLVIMENTO');
    expect(rotuloAmbiente('teste')).toBe('TESTE');
  });
});
