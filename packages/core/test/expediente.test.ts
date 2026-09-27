import { describe, expect, it } from 'vitest';
import { estaNoExpediente, mesReferencia } from '../src/expediente';

const cfg = { inicio: '08:00', fim: '18:00', diasUteis: [1, 2, 3, 4, 5], feriados: ['2026-10-12'] };

describe('estaNoExpediente', () => {
  it('segunda às 10h em São Paulo está no expediente', () => {
    expect(estaNoExpediente(new Date('2026-09-28T13:00:00Z'), cfg)).toBe(true);
  });
  it('segunda às 18h já está fora', () => {
    expect(estaNoExpediente(new Date('2026-09-28T21:00:00Z'), cfg)).toBe(false);
  });
  it('sábado está fora', () => {
    expect(estaNoExpediente(new Date('2026-09-26T13:00:00Z'), cfg)).toBe(false);
  });
  it('feriado está fora', () => {
    expect(estaNoExpediente(new Date('2026-10-12T13:00:00Z'), cfg)).toBe(false);
  });
});

describe('mesReferencia', () => {
  it('usa o fuso de São Paulo na virada do mês', () => {
    expect(mesReferencia(new Date('2026-10-01T02:00:00Z'))).toBe('2026-09');
  });
});
