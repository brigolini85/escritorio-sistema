import { beforeEach, describe, expect, it, vi } from 'vitest';

// Sobra 1 da Parte B (decisão P1): o lápis do contato abre o painel, onde o Nome é editável.
const falso = vi.hoisted(() => ({ pode: true, atualizacoes: [] as Record<string, unknown>[], linhas: [{ id: 'c1' }] as { id: string }[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'atendente', niveis: { clientes: falso.pode ? 'editar' : 'ver' } }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    from: () => ({
      update: (dados: Record<string, unknown>) => {
        falso.atualizacoes.push(dados);
        return { eq: () => ({ eq: () => ({ select: async () => ({ data: falso.linhas, error: null }) }) }) };
      },
    }),
  }),
}));

import { renomearContato } from './acoes';

const ID = '22222222-2222-4222-8222-222222222222';
const comNome = (nome: string) => { const f = new FormData(); f.append('nome', nome); return f; };

beforeEach(() => {
  falso.pode = true;
  falso.atualizacoes = [];
  falso.linhas = [{ id: ID }];
});

describe('renomearContato', () => {
  it('grava o nome sem espaços nas pontas', async () => {
    expect(await renomearContato(ID, comNome('  Maria Souza '))).toEqual({ ok: true });
    expect(falso.atualizacoes).toEqual([{ nome: 'Maria Souza' }]);
  });
  it('nome curto, sem permissão ou contato que saiu (arquivado): erro, nada gravado', async () => {
    expect(await renomearContato(ID, comNome('M'))).toEqual({ ok: false, erro: 'Informe o nome do contato.' });
    falso.linhas = [];
    expect(await renomearContato(ID, comNome('Maria'))).toEqual({ ok: false, erro: 'Contato não encontrado.' });
    falso.pode = false;
    expect(await renomearContato(ID, comNome('Maria'))).toEqual({ ok: false, erro: 'Você não tem permissão para editar contatos.' });
    expect(falso.atualizacoes).toEqual([{ nome: 'Maria' }]);
  });
});
