// Revisão geral I7: o número que a Z-API entrega já vem com o DDI. 11 dígitos sem 55 é estrangeiro (ex.: EUA, +1),
// não um celular brasileiro sem DDI: normalizar como brasileiro mandaria a resposta para outra pessoa.
import { describe, expect, it } from 'vitest';
import { telefoneDoWhatsApp } from '../src/telefone';

describe('telefoneDoWhatsApp', () => {
  it('aceita só número brasileiro com DDI', () => {
    expect(telefoneDoWhatsApp('5531999990001')).toBe('5531999990001');
    expect(telefoneDoWhatsApp('553199990001')).toBe('553199990001');
    expect(telefoneDoWhatsApp('+55 (31) 99999-0001')).toBe('5531999990001');
  });
  it('recusa estrangeiro, sem DDI e identificador @lid', () => {
    expect(telefoneDoWhatsApp('14155550123')).toBeNull();
    expect(telefoneDoWhatsApp('351912345678')).toBeNull();
    expect(telefoneDoWhatsApp('31999990001')).toBeNull();
    expect(telefoneDoWhatsApp('123456789012345@lid')).toBeNull();
    expect(telefoneDoWhatsApp('5531999990001@lid')).toBeNull();
  });
});
