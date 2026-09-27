import { describe, expect, it } from 'vitest';
import { calcularCustoUsd } from '../src/custo';

describe('calcularCustoUsd', () => {
  it('soma entrada, saída e cache por milhão de tokens', () => {
    const custo = calcularCustoUsd(
      { entrada: 1_000_000, saida: 100_000, cacheLeitura: 500_000, cacheEscrita: 0 },
      { entrada: 2, saida: 10, cacheLeitura: 0.2, cacheEscrita: 2.5 },
    );
    expect(custo).toBeCloseTo(2 + 1 + 0.1, 6);
  });
});
