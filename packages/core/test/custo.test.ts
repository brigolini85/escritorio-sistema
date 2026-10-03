import { describe, expect, it } from 'vitest';
import { calcularCustoUsd, custoTranscricaoUsd, usoDaResposta, FUNCIONALIDADES_IA, PROVEDORES_IA } from '../src/custo';

describe('calcularCustoUsd', () => {
  it('soma entrada, saída e cache por milhão de tokens', () => {
    const custo = calcularCustoUsd(
      { entrada: 1_000_000, saida: 100_000, cacheLeitura: 500_000, cacheEscrita: 0 },
      { entrada: 2, saida: 10, cacheLeitura: 0.2, cacheEscrita: 2.5 },
    );
    expect(custo).toBeCloseTo(2 + 1 + 0.1, 6);
  });
});

describe('usoDaResposta', () => {
  it('tokens da Anthropic, com cache ausente valendo 0', () => {
    expect(usoDaResposta({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 100, cache_creation_input_tokens: null }))
      .toEqual({ entrada: 10, saida: 5, cacheLeitura: 100, cacheEscrita: 0 });
  });
});

describe('custoTranscricaoUsd', () => {
  it('segundos ÷ 60 × preço por minuto', () => expect(custoTranscricaoUsd(90, 0.002)).toBeCloseTo(0.003, 6));
  it('sem preço configurado ou sem duração: 0', () => {
    expect(custoTranscricaoUsd(90, null)).toBe(0);
    expect(custoTranscricaoUsd(null, 0.002)).toBe(0);
    expect(custoTranscricaoUsd(-5, 0.002)).toBe(0);
  });
});

it('provedores e funcionalidades: a lista do banco', () => {
  expect(PROVEDORES_IA).toEqual(['anthropic', 'groq']);
  expect(FUNCIONALIDADES_IA).toContain('nao_identificado');
});
