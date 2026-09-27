import { describe, expect, it } from 'vitest';
import { escolherResponsavel } from '../src/roteamento';

describe('escolherResponsavel', () => {
  const resp = [{ setorId: 'fiscal', usuarioId: 'ana' }];
  it('usa o responsável do cliente naquele setor', () => {
    expect(escolherResponsavel('fiscal', resp)).toBe('ana');
  });
  it('sem responsável definido, vai para a fila do setor', () => {
    expect(escolherResponsavel('pessoal', resp)).toBeNull();
  });
  it('triagem (setor nulo) nunca tem responsável automático', () => {
    expect(escolherResponsavel(null, resp)).toBeNull();
  });
});
