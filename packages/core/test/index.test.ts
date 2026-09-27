import { describe, expect, it } from 'vitest';
import { FUSO_HORARIO } from '../src/index';

describe('core', () => {
  it('usa o fuso de São Paulo', () => {
    expect(FUSO_HORARIO).toBe('America/Sao_Paulo');
  });
});
