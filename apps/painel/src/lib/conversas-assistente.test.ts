import { describe, expect, it } from 'vitest';
import { agruparConversasAssistente, lerConversaAssistente } from './conversas-assistente';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('agruparConversasAssistente', () => {
  it('agrupa por atendimento na ordem da mais nova, sem a Geral', () => {
    const r = agruparConversasAssistente([
      { conversa_id: B, criado_em: '2026-09-30T12:00:00Z' },
      { conversa_id: null, criado_em: '2026-09-30T11:30:00Z' },
      { conversa_id: A, criado_em: '2026-09-30T11:00:00Z' },
      { conversa_id: B, criado_em: '2026-09-30T10:00:00Z' },
    ]);
    expect(r).toEqual([
      { conversaId: B, ultimaEm: '2026-09-30T12:00:00Z', mensagens: 2 },
      { conversaId: A, ultimaEm: '2026-09-30T11:00:00Z', mensagens: 1 },
    ]);
  });

  it('respeita o limite de conversas', () => {
    const r = agruparConversasAssistente([
      { conversa_id: A, criado_em: '2026-09-30T12:00:00Z' },
      { conversa_id: B, criado_em: '2026-09-30T11:00:00Z' },
      { conversa_id: A, criado_em: '2026-09-30T10:00:00Z' },
    ], 1);
    expect(r.map((c) => [c.conversaId, c.mensagens])).toEqual([[A, 2]]);
  });

  it('sem mensagens de atendimento, lista vazia', () => {
    expect(agruparConversasAssistente([{ conversa_id: null, criado_em: '2026-09-30T12:00:00Z' }])).toEqual([]);
  });
});

describe('lerConversaAssistente', () => {
  it('aceita só id válido', () => {
    expect(lerConversaAssistente(A)).toBe(A);
    expect(lerConversaAssistente(A.toUpperCase())).toBe(A);
    expect(lerConversaAssistente([B, A])).toBe(B);
    expect(lerConversaAssistente('abc')).toBeNull();
    expect(lerConversaAssistente(undefined)).toBeNull();
    expect(lerConversaAssistente('')).toBeNull();
  });
});
