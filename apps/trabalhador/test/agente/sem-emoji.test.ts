import { describe, expect, it } from 'vitest';
import { semEmoji } from '../../src/agente/ferramentas';

describe('semEmoji (pedido do dono, 2026-09-29)', () => {
  it('tira emoji sem deixar espaço sobrando', () => {
    expect(semEmoji('Por nada, Thiago! Qualquer coisa é só chamar 😊')).toBe('Por nada, Thiago! Qualquer coisa é só chamar');
    expect(semEmoji('Bom dia 👋, tudo bem? 👍🏽')).toBe('Bom dia, tudo bem?');
    expect(semEmoji('Pode deixar ❤️\n\nJá passo pro Fiscal 🇧🇷')).toBe('Pode deixar\n\nJá passo pro Fiscal');
  });
  it('não mexe em texto comum, números e valores', () => {
    expect(semEmoji('Costela: R$ 9,50 (cód. 12) – 20 PAC')).toBe('Costela: R$ 9,50 (cód. 12) – 20 PAC');
  });
});
