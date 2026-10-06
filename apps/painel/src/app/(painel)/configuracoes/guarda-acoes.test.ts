import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({ rpcs: [] as unknown[], erro: null as { code?: string; message: string } | null }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: () => {} }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'eu', papel: 'admin', niveis: {}, setores: [] }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({ rpc: async (nome: string, args: unknown) => { falso.rpcs.push({ nome, args }); return { data: null, error: falso.erro }; } }),
}));
import { salvarGuardaTarefas } from './guarda-acoes';

describe('salvarGuardaTarefas (D14)', () => {
  beforeEach(() => { falso.rpcs = []; falso.erro = null; });
  it('grava o prazo ou "nunca"; prazo fora da lista não vai ao banco', async () => {
    expect(await salvarGuardaTarefas(365)).toEqual({ ok: true });
    expect(await salvarGuardaTarefas(null)).toEqual({ ok: true });
    expect(await salvarGuardaTarefas(45)).toEqual({ ok: false, erro: 'Escolha 90, 180, 365 ou 730 dias, ou nunca apagar.' });
    expect(falso.rpcs).toEqual([{ nome: 'salvar_guarda_tarefas', args: { p_dias: 365 } }, { nome: 'salvar_guarda_tarefas', args: { p_dias: null } }]);
  });
  it('a recusa do banco ("só o dono") vai à tela', async () => {
    falso.erro = { code: 'P0001', message: 'Só o dono muda a guarda dos arquivos das tarefas.' };
    expect(await salvarGuardaTarefas(90)).toEqual({ ok: false, erro: 'Só o dono muda a guarda dos arquivos das tarefas.' });
  });
});
