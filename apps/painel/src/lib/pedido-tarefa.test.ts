import { describe, expect, it } from 'vitest';
import { textoAvisos, textoPrazoDesejado } from './tarefas-tela';

describe('o pedido na tela da tarefa (I4)', () => {
  const p = { prazoDesejado: null, avisarPainel: true, avisarWhatsapp: true, subpasta: null, lerDrive: true, pediuPeloAssistente: false };
  it('avisos', () => {
    expect(textoAvisos(p)).toBe('Avisos: painel e WhatsApp');
    expect(textoAvisos({ ...p, avisarWhatsapp: false })).toBe('Avisos: painel');
    expect(textoAvisos({ ...p, avisarPainel: false })).toBe('Avisos: WhatsApp');
    expect(textoAvisos({ ...p, avisarPainel: false, avisarWhatsapp: false })).toBe('Sem avisos');
  });
  it('prazo desejado em Brasília e atrasado com palavra (vermelho nunca sozinho)', () => {
    expect(textoPrazoDesejado('2026-10-08T15:00:00Z', new Date('2026-10-06T13:00:00Z'))).toEqual({ texto: 'Prazo desejado: 08/10 12:00', atrasado: false });
    expect(textoPrazoDesejado('2026-10-05T15:00:00Z', new Date('2026-10-06T13:00:00Z'))).toEqual({ texto: 'Prazo desejado: 05/10 12:00 · passou', atrasado: true });
  });
});
