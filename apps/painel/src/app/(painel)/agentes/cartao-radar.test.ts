import { describe, expect, it } from 'vitest';
import { textoCartaoRadar } from './cartao-radar';

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
