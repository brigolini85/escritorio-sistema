import { describe, expect, it } from 'vitest';
import { empresaDoUso } from '../src';

// Prompt F: uma regra só para a empresa de um gasto com IA (agente, Sugerir resposta, transcrição).
describe('empresaDoUso', () => {
  const a = { id: 'a' };
  const b = { id: 'b' };
  it('empresa em foco que é do contato', () => {
    expect(empresaDoUso('b', [a, b])).toBe('b');
  });
  it('várias empresas e nenhuma em foco: sem empresa (nunca a primeira da lista)', () => {
    expect(empresaDoUso(null, [a, b])).toBeNull();
  });
  it('uma empresa só e nenhuma em foco: essa empresa', () => {
    expect(empresaDoUso(null, [a])).toBe('a');
  });
  it('foco que não é mais do contato: cai na regra da empresa única', () => {
    expect(empresaDoUso('x', [a])).toBe('a');
    expect(empresaDoUso('x', [a, b])).toBeNull();
  });
  it('contato sem empresas (ou não cadastrado): sem empresa', () => {
    expect(empresaDoUso('a', [])).toBeNull();
    expect(empresaDoUso(null, [])).toBeNull();
  });
});
