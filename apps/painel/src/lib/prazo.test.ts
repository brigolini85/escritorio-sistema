import { describe, expect, it } from 'vitest';
import { descreverPrazo, doCampoDataHora, horaCurta, paraCampoDataHora, prazoAbsoluto } from './prazo';

// Quinta, 08/10/2026, 10:00 em Brasília.
const AGORA = new Date('2026-10-08T13:00:00Z');
const aberta = (prazo: string | null, pausadoDesde: string | null = null) => descreverPrazo({ prazo, pausadoDesde, concluidaEm: null }, AGORA);

describe('descreverPrazo (imagens 03 e 04)', () => {
  it('hoje com hora, amanhã, depois a data', () => {
    expect(aberta('2026-10-08T21:00:00Z')).toEqual({ texto: 'hoje 18h', tom: 'hoje' });
    expect(aberta('2026-10-09T21:00:00Z')).toEqual({ texto: 'amanhã', tom: 'normal' });
    expect(aberta('2026-10-13T21:00:00Z')).toEqual({ texto: '13/10', tom: 'normal' });
  });
  it('vencida: hora se foi hoje, data se foi antes', () => {
    expect(aberta('2026-10-08T12:30:00Z')).toEqual({ texto: 'venceu 9h30', tom: 'vencido' });
    expect(aberta('2026-10-07T21:00:00Z')).toEqual({ texto: 'venceu 07/10', tom: 'vencido' });
  });
  it('pausada em "Com o cliente" não vence; sem prazo diz isso', () => {
    expect(aberta('2026-10-07T21:00:00Z', '2026-10-06T13:00:00Z')).toEqual({ texto: 'pausado', tom: 'pausado' });
    expect(aberta(null)).toEqual({ texto: 'sem prazo', tom: 'sem' });
  });
  it('concluída: no prazo ou fora do prazo', () => {
    expect(descreverPrazo({ prazo: '2026-10-08T21:00:00Z', pausadoDesde: null, concluidaEm: '2026-10-08T20:00:00Z' }, AGORA)).toEqual({ texto: 'no prazo', tom: 'no-prazo' });
    expect(descreverPrazo({ prazo: '2026-10-08T21:00:00Z', pausadoDesde: null, concluidaEm: '2026-10-09T13:00:00Z' }, AGORA)).toEqual({ texto: 'fora do prazo', tom: 'vencido' });
  });
});

describe('formatos do prazo', () => {
  it('hora curta e prazo absoluto no horário de Brasília', () => {
    expect(horaCurta(new Date('2026-10-08T20:00:00Z'))).toBe('17h');
    expect(horaCurta(new Date('2026-10-08T20:30:00Z'))).toBe('17h30');
    expect(prazoAbsoluto('2026-10-13T21:00:00Z')).toBe('13/10 18h');
  });
  it('campo datetime-local de ida e volta (Brasília, sem horário de verão)', () => {
    expect(paraCampoDataHora('2026-10-13T21:00:00Z')).toBe('2026-10-13T18:00');
    expect(paraCampoDataHora(null)).toBe('');
    expect(doCampoDataHora('2026-10-13T18:00')).toBe('2026-10-13T21:00:00.000Z');
    expect(doCampoDataHora('13/10/2026')).toBeNull();
    expect(doCampoDataHora('')).toBeNull();
  });
});
