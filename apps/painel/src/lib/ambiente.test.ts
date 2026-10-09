import { describe, expect, it } from 'vitest';
import { divergenciaAmbiente, rotuloAmbiente } from './ambiente';

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

describe('divergenciaAmbiente (auditoria 3.13)', () => {
  it('banco sem ambiente (ainda sem trabalhador) ou igual: sem faixa', () => {
    expect(divergenciaAmbiente('producao', null)).toBeNull();
    expect(divergenciaAmbiente('producao', 'producao')).toBeNull();
    expect(divergenciaAmbiente(' Homologacao ', 'homologacao')).toBeNull();
  });
  it('diferente: o aviso diz os dois', () => {
    expect(divergenciaAmbiente('homologacao', 'producao'))
      .toBe('Este painel está configurado como HOMOLOGAÇÃO, mas o banco é de PRODUÇÃO. Confira o AMBIENTE do painel no Easypanel.');
    expect(divergenciaAmbiente(undefined, 'local')).toContain('LOCAL');
  });
});
