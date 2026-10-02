import { describe, expect, it, vi } from 'vitest';

// Salvar a pessoa não decide mais o arquivo: a chave Ativo saiu (arquivar é pelo Excluir…, painel v2 parte B).
const falso = vi.hoisted(() => ({ atualizacoes: [] as Record<string, unknown>[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/erro-formulario', () => ({ comAvisoDeErro: async (_destino: string, acao: () => Promise<void>) => acao() }));
vi.mock('@/lib/sessao', () => ({ exigirAdmin: async () => ({ id: 'adm', papel: 'admin' }) }));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({ from: () => ({ select: () => ({ in: async () => ({ data: [] }) }) }) }) }));
const fim = { eq: async () => ({ error: null }) };
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    from: () => ({
      update: (dados: Record<string, unknown>) => { falso.atualizacoes.push(dados); return fim; },
      delete: () => fim,
      insert: async () => ({ error: null }),
    }),
  }),
}));

import { salvarUsuario } from './acoes';

describe('salvarUsuario', () => {
  it('não grava ativo, mesmo sem a chave no formulário', async () => {
    const f = new FormData();
    f.append('nome', 'Bia Souza');
    f.append('email', 'bia@escritorio.com');
    f.append('papel', 'atendente');
    await salvarUsuario('11111111-1111-4111-8111-111111111111', f);
    expect(falso.atualizacoes).toHaveLength(1);
    expect(falso.atualizacoes[0]).not.toHaveProperty('ativo');
    expect(falso.atualizacoes[0]).toMatchObject({ nome: 'Bia Souza', papel: 'atendente' });
  });
});
