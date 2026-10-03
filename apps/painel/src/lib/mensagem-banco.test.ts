import { describe, expect, it } from 'vitest';
import { mensagemDoBanco } from './mensagem-banco';

describe('mensagemDoBanco', () => {
  it('empresa inativa no banco vira "arquivada" no painel', () => {
    const m = mensagemDoBanco('Esta empresa está inativa. Escolha outra empresa ou reative o cadastro.');
    expect(m).toBe('Esta empresa está arquivada. Escolha outra empresa ou traga o cadastro de volta.');
    expect(m).not.toMatch(/inativ/i);
  });
  it('outra mensagem passa como veio', () => {
    expect(mensagemDoBanco('Orientação não encontrada.')).toBe('Orientação não encontrada.');
  });
});
