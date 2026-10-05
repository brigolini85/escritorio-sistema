import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({ erro: null as { code: string; message: string } | null, chamadas: [] as [string, unknown][], revalidados: [] as string[] }));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'atendente', niveis: {}, setores: [] }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({ rpc: async (nome: string, args: unknown) => { falso.chamadas.push([nome, args]); return { data: 'aprovada', error: falso.erro }; } }),
}));
const { decidirSugestao } = await import('./agente-demanda-acoes');
const ID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => { Object.assign(falso, { erro: null, chamadas: [], revalidados: [] }); });

describe('decidir a sugestão do agente (D19)', () => {
  it('aprova pela função do banco e atualiza a tela de demandas', async () => {
    expect(await decidirSugestao(ID, true)).toEqual({ ok: true });
    expect(falso.chamadas).toEqual([['decidir_sugestao', { p_id: ID, p_aprovar: true }]]);
    expect(falso.revalidados).toContain('/demandas');
  });
  it('id estranho não chega ao banco', async () => {
    expect(await decidirSugestao('x', true)).toEqual({ ok: false, erro: 'Sugestão não encontrada.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('recusa do banco vira a frase (clique duplo, outro setor, demanda concluída)', async () => {
    falso.erro = { code: 'P0001', message: 'Esta sugestão já foi decidida.' };
    expect(await decidirSugestao(ID, true)).toEqual({ ok: false, erro: 'Esta sugestão já foi decidida.' });
  });
  it('outro erro: frase genérica', async () => {
    falso.erro = { code: '57014', message: 'timeout' };
    expect(await decidirSugestao(ID, false)).toEqual({ ok: false, erro: 'Não foi possível salvar agora. Tente de novo.' });
  });
});
