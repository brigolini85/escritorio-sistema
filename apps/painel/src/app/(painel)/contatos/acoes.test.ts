import { beforeEach, describe, expect, it, vi } from 'vitest';

// Sobra 1 da Parte B (decisão P1): o lápis do contato abre o painel, onde o Nome é editável.
const falso = vi.hoisted(() => ({ pode: true, atualizacoes: [] as Record<string, unknown>[], linhas: [{ id: 'c1' }] as { id: string }[], erro: null as { code: string; message: string } | null }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'atendente', niveis: { clientes: falso.pode ? 'editar' : 'ver' } }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    from: () => ({
      update: (dados: Record<string, unknown>) => {
        falso.atualizacoes.push(dados);
        return { eq: () => ({ eq: () => ({ select: async () => (falso.erro ? { data: null, error: falso.erro } : { data: falso.linhas, error: null }) }) }) };
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
  falso.erro = null;
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
  it('erro do banco: só o raise exception (P0001) chega à tela; o resto vira a frase genérica', async () => {
    falso.erro = { code: '42501', message: 'new row violates row-level security policy for table "contatos"' };
    expect(await renomearContato(ID, comNome('Maria'))).toEqual({ ok: false, erro: 'Não foi possível salvar agora. Tente de novo.' });
    falso.erro = { code: 'P0001', message: 'Contato arquivado não pode ser alterado.' };
    expect(await renomearContato(ID, comNome('Maria'))).toEqual({ ok: false, erro: 'Contato arquivado não pode ser alterado.' });
  });
});
