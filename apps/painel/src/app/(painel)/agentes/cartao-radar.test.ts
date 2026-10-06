import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { radarSemMigracao, textoCartaoRadar } = await import('./cartao-radar');

const agora = new Date('2026-10-26T15:00:00Z');
describe('textoCartaoRadar', () => {
  it('sem a migração I5 mantém a frase de hoje', () => {
    expect(textoCartaoRadar({ semI5: true, paraDecidir: 0, ultimoGiro: null, agora }))
      .toEqual({ principal: 'Novidades da legislação: chegam na etapa do Radar.', giro: null });
  });
  it('plural, singular e nada para decidir', () => {
    expect(textoCartaoRadar({ semI5: false, paraDecidir: 3, ultimoGiro: null, agora }).principal).toBe('3 novidades para decidir');
    expect(textoCartaoRadar({ semI5: false, paraDecidir: 1, ultimoGiro: null, agora }).principal).toBe('1 novidade para decidir');
    expect(textoCartaoRadar({ semI5: false, paraDecidir: 0, ultimoGiro: null, agora }).principal).toBe('Nada para decidir');
  });
  it('último giro: hoje com hora, outro dia com data, nunca', () => {
    expect(textoCartaoRadar({ semI5: false, paraDecidir: 0, ultimoGiro: '2026-10-26T10:03:00Z', agora }).giro).toBe('Último giro: hoje 07:03');
    expect(textoCartaoRadar({ semI5: false, paraDecidir: 0, ultimoGiro: '2026-10-25T10:03:00Z', agora }).giro).toBe('Último giro: 25/10 07:03');
    expect(textoCartaoRadar({ semI5: false, paraDecidir: 0, ultimoGiro: null, agora }).giro).toBe('Nenhum giro ainda');
  });
});

describe('radarSemMigracao', () => {
  const falta = { code: 'PGRST205' };
  it('erro de tabela ausente na contagem', () => {
    expect(radarSemMigracao({ contagem: { count: null, error: falta }, giro: { error: null } })).toBe(true);
  });
  it('contagem nula sem erro e giros sem a tabela', () => {
    expect(radarSemMigracao({ contagem: { count: null, error: null }, giro: { error: falta } })).toBe(true);
  });
  it('tudo certo', () => {
    expect(radarSemMigracao({ contagem: { count: 3, error: null }, giro: { error: null } })).toBe(false);
  });
  it('outro erro na contagem não é falta de migração', () => {
    expect(radarSemMigracao({ contagem: { count: null, error: { code: '57014' } }, giro: { error: null } })).toBe(false);
  });
});
