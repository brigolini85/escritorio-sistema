import { describe, expect, it } from 'vitest';
import { gruposDeSkills, textoDeUso } from './uso';

const s = (tipo: 'jeito' | 'limites' | 'procedimento' | 'conhecimento' | 'exemplos', nome: string, ativo = true) =>
  ({ id: nome, nome, tipo, ativo, versao: 1, titulo: nome, descricao: '', arquivos: [], atualizadaEm: '2026-10-01T12:00:00Z', autor: null });

describe('aba Skills (spec 7E.3, D10)', () => {
  it('os 5 grupos na ordem da tela, mesmo vazios', () => {
    const g = gruposDeSkills([s('exemplos', 'boas'), s('jeito', 'tom'), s('procedimento', 'nota'), s('procedimento', 'certidao')]);
    expect(g.map((x) => [x.tipo, x.skills.map((y) => y.nome)])).toEqual([
      ['jeito', ['tom']], ['limites', []], ['procedimento', ['certidao', 'nota']], ['conhecimento', []], ['exemplos', ['boas']],
    ]);
  });
  it('uso: sempre lidas, vezes no mês, nunca usada, desligada', () => {
    const uso = new Map([['nota', 19]]);
    expect(textoDeUso(s('limites', 'x'), uso)).toBe('em toda conversa');
    expect(textoDeUso(s('procedimento', 'nota'), uso)).toBe('usada 19× no mês');
    expect(textoDeUso(s('conhecimento', 'cfop'), uso)).toBe('ainda não usada');
    expect(textoDeUso(s('conhecimento', 'cfop', false), uso)).toBe('desligada');
  });
});
