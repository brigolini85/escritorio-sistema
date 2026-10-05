import { beforeEach, describe, expect, it, vi } from 'vitest';

const C1 = '11111111-1111-4111-8111-111111111111';
const FIS = '33333333-3333-4333-8333-333333333333';
const falso = vi.hoisted(() => ({
  erroRpc: null as { code: string; message: string } | null,
  dados: 'irpf' as unknown,
  chamadas: [] as [string, unknown][],
  revalidados: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'admin', niveis: {}, setores: [] }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: unknown) => { falso.chamadas.push([nome, args]); return { data: falso.dados, error: falso.erroRpc }; },
  }),
}));
const { criarAgente, definirContatosTeste, salvarAgente, salvarRegraAssunto } = await import('./agentes-acoes');

beforeEach(() => { Object.assign(falso, { erroRpc: null, dados: 'irpf', chamadas: [], revalidados: [] }); });

describe('ações do dono (D11, D14)', () => {
  it('salvarAgente manda só as chaves que mudaram, com os nomes do banco', async () => {
    expect(await salvarAgente('fiscal', { estado: 'teste', modoContato: 'mesma_voz', setorId: FIS })).toEqual({ ok: true });
    expect(falso.chamadas).toEqual([['salvar_agente', { p_slug: 'fiscal', p_dados: { estado: 'teste', modo_contato: 'mesma_voz', setor_id: FIS } }]]);
    expect(falso.revalidados).toContain('/agentes');
  });
  it('dado inválido não chega ao banco', async () => {
    expect(await salvarAgente('fiscal', { estado: 'quase' as never })).toEqual({ ok: false, erro: 'Estado inválido.' });
    expect(await definirContatosTeste('fiscal', ['nao-e-uuid'])).toEqual({ ok: false, erro: 'Contato inválido.' });
    expect(await definirContatosTeste('fiscal', Array.from({ length: 21 }, () => C1))).toEqual({ ok: false, erro: 'Em teste, no máximo 20 contatos.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('recusa do banco (P0001) vira a frase para a pessoa', async () => {
    falso.erroRpc = { code: 'P0001', message: 'Só o dono altera os agentes.' };
    expect(await salvarRegraAssunto('fiscal', null, { assunto: 'Nota', exemplo: '', modo: 'mesma_voz' })).toEqual({ ok: false, erro: 'Só o dono altera os agentes.' });
  });
  it('criarAgente tira o endereço do nome (D25)', async () => {
    expect(await criarAgente({ nome: 'Agente do IRPF', setorId: null, tipos: ['conversa'], descricao: '' })).toEqual({ ok: true, slug: 'irpf' });
    expect(falso.chamadas[0]).toEqual(['criar_agente', { p_dados: { slug: 'agente-do-irpf', nome: 'Agente do IRPF', setor_id: null, tipos: ['conversa'], descricao: '' } }]);
  });
});
