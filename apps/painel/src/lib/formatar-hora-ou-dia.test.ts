import { describe, expect, it } from 'vitest';
import { formatarHoraOuDia } from './formatos';

// "gerado HH:MM" do arquivo do Bling: de outro dia, a hora vem com a data (sobra da Task 6 da G4).
describe('formatarHoraOuDia', () => {
  const agora = '2026-10-04T15:00:00-03:00';

  it('hoje (Brasília): só a hora', () => {
    expect(formatarHoraOuDia('2026-10-04T09:07:00-03:00', agora)).toBe('09:07');
  });

  it('outro dia: dd/mm e a hora', () => {
    expect(formatarHoraOuDia('2026-10-01T14:05:00-03:00', agora)).toBe('01/10 14:05');
  });

  it('o dia é o de Brasília, não o UTC: 23h30 de ontem em Brasília já é hoje em UTC', () => {
    expect(formatarHoraOuDia('2026-10-04T02:30:00Z', agora)).toBe('03/10 23:30');
  });

  it('data inválida não derruba a tela', () => {
    expect(formatarHoraOuDia('não é data', agora)).toBe('');
  });
});
