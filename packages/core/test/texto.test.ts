import { describe, expect, it } from 'vitest';
import { formatarMensagem } from '../src/texto';

describe('formatarMensagem', () => {
  it('substitui variáveis e mantém as desconhecidas', () => {
    expect(formatarMensagem('das {inicio} às {fim} {x}', { inicio: '08:00', fim: '18:00' })).toBe('das 08:00 às 18:00 {x}');
  });
});
