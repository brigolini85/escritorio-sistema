import { describe, expect, it } from 'vitest';
import { resumirAtividade } from './resumo';

describe('Atividade e custo (D18)', () => {
  it('soma os dias; passagens = atendimentos − resolvidos; % sozinho', () => {
    expect(resumirAtividade([
      { dia: '2026-10-01', atendimentos: 1, resolvidos: 1, custo_usd: 0.6, custo_testes_usd: 0 },
      { dia: '2026-10-02', atendimentos: 3, resolvidos: 2, custo_usd: '0.3', custo_testes_usd: '0.1' },
    ])).toEqual({ atendimentos: 4, resolvidos: 3, passagens: 1, custoUsd: 0.9, custoTestesUsd: 0.1, sozinho: 75 });
    expect(resumirAtividade([])).toEqual({ atendimentos: 0, resolvidos: 0, passagens: 0, custoUsd: 0, custoTestesUsd: 0, sozinho: null });
  });
});
