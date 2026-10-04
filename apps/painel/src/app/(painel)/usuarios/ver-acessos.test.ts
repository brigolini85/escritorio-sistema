import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  rpcs: [] as { nome: string; args: Record<string, unknown> }[],
  erro: null as { code?: string; message: string } | null,
  admin: true,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/sessao', () => ({
  exigirAdmin: async () => {
    // Igual ao de verdade: quem não é administrador é mandado embora antes de qualquer coisa.
    if (!falso.admin) throw new Error('NEXT_REDIRECT /inicio');
    return { id: 'adm', papel: 'admin' };
  },
}));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({ rpc: async (nome: string, args: Record<string, unknown>) => { falso.rpcs.push({ nome, args }); return { error: falso.erro }; } }),
}));

import { definirVerAcessos } from './ver-acessos';

const BIA = '11111111-1111-4111-8111-111111111111';
beforeEach(() => { falso.rpcs = []; falso.erro = null; falso.admin = true; });

describe('permissão "Ver acessos de portais" (D3, D4)', () => {
  it('grava na hora pela função do banco', async () => {
    expect(await definirVerAcessos(BIA, true)).toEqual({ ok: true });
    expect(falso.rpcs).toEqual([{ nome: 'definir_ver_acessos', args: { p_usuario: BIA, p_pode: true } }]);
  });
  it('id fora do formato não chega ao banco; erro desconhecido vira aviso fixo', async () => {
    expect(await definirVerAcessos('x', true)).toEqual({ ok: false, erro: 'Pessoa não encontrada.' });
    expect(falso.rpcs).toEqual([]);
    falso.erro = { message: 'qualquer coisa do banco' };
    expect(await definirVerAcessos(BIA, false)).toEqual({ ok: false, erro: 'Não consegui salvar agora. Tente de novo.' });
  });
  it('só o administrador: os outros nem chegam ao banco', async () => {
    falso.admin = false;
    await expect(definirVerAcessos(BIA, true)).rejects.toThrow('NEXT_REDIRECT');
    expect(falso.rpcs).toEqual([]);
  });
  it('"pode" precisa ser sim ou não de verdade (a ação é chamável pelo navegador)', async () => {
    expect(await definirVerAcessos(BIA, 'true' as never)).toEqual({ ok: false, erro: 'Não consegui salvar agora. Tente de novo.' });
    expect(falso.rpcs).toEqual([]);
  });
  it('"Pessoa não encontrada." só passa quando é a recusa da função (P0001)', async () => {
    falso.erro = { code: 'P0001', message: 'Pessoa não encontrada.' };
    expect(await definirVerAcessos(BIA, true)).toEqual({ ok: false, erro: 'Pessoa não encontrada.' });
    falso.erro = { code: 'XX000', message: 'Pessoa não encontrada.' };
    expect(await definirVerAcessos(BIA, true)).toEqual({ ok: false, erro: 'Não consegui salvar agora. Tente de novo.' });
  });
});
