import { beforeEach, describe, expect, it, vi } from 'vitest';

// Salvar a pessoa devolve o resultado para a tela (o erro fica no campo, sobra 6 da Parte B), sem ?erro= na URL.
const falso = vi.hoisted(() => ({
  atualizacoes: [] as Record<string, unknown>[],
  donos: [] as { id: string; nome: string; ativo: boolean }[],
  erroBanco: null as { message: string } | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/erro-formulario', () => ({ mensagemDeErro: (e: unknown) => (e instanceof Error ? e.message : 'Não foi possível salvar.') }));
vi.mock('@/lib/sessao', () => ({ exigirAdmin: async () => ({ id: 'adm', papel: 'admin' }) }));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({ from: () => ({ select: () => ({ in: async () => ({ data: falso.donos }) }) }) }) }));
const fim = { eq: async () => ({ error: falso.erroBanco }) };
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

const BIA = '11111111-1111-4111-8111-111111111111';
function formulario(campos: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ nome: 'Bia Souza', email: 'bia@escritorio.com', papel: 'atendente', ...campos })) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
}

beforeEach(() => {
  falso.atualizacoes = [];
  falso.donos = [];
  falso.erroBanco = null;
});

describe('salvarUsuario', () => {
  it('salva sem gravar ativo e devolve ok', async () => {
    expect(await salvarUsuario(BIA, formulario({}))).toEqual({ ok: true });
    expect(falso.atualizacoes).toHaveLength(1);
    expect(falso.atualizacoes[0]).not.toHaveProperty('ativo');
    expect(falso.atualizacoes[0]).toMatchObject({ nome: 'Bia Souza', papel: 'atendente' });
  });
  it('telefone inválido: erro no campo e nada gravado', async () => {
    expect(await salvarUsuario(BIA, formulario({ telefone: '12345' }))).toEqual({ ok: false, erros: { telefone: 'Telefone inválido' } });
    expect(falso.atualizacoes).toEqual([]);
  });
  it('nome curto e WhatsApp sem telefone: erro em cada campo', async () => {
    expect(await salvarUsuario(BIA, formulario({ nome: 'B' }))).toEqual({ ok: false, erros: { nome: 'Informe o nome' } });
    expect(await salvarUsuario(BIA, formulario({ permissao: 'assistente_whatsapp' })))
      .toEqual({ ok: false, erros: { telefone: 'Informe o telefone para usar o assistente pelo WhatsApp' } });
  });
  it('telefone de outra pessoa: erro no campo telefone', async () => {
    falso.donos = [{ id: 'outra', nome: 'Zé', ativo: true }];
    expect(await salvarUsuario(BIA, formulario({ telefone: '(31) 99999-1801' })))
      .toEqual({ ok: false, erros: { telefone: 'Este telefone já é de Zé.' } });
    expect(falso.atualizacoes).toEqual([]);
  });
  it('telefone de pessoa arquivada: diz isso e oferece restaurar', async () => {
    falso.donos = [{ id: 'ze', nome: 'Zé', ativo: false }];
    expect(await salvarUsuario(BIA, formulario({ telefone: '(31) 99999-1801' }))).toEqual({
      ok: false,
      erros: { telefone: 'Este telefone é de Zé, que está nos arquivados. Restaure Zé ou use outro telefone.' },
      telefoneDeArquivado: { id: 'ze', nome: 'Zé' },
    });
    expect(falso.atualizacoes).toEqual([]);
  });
  it('o próprio telefone não conflita', async () => {
    falso.donos = [{ id: BIA, nome: 'Bia Souza', ativo: true }];
    expect(await salvarUsuario(BIA, formulario({ telefone: '(31) 99999-1801' }))).toEqual({ ok: true });
  });
  it('erro do banco vai para o aviso geral do formulário', async () => {
    falso.erroBanco = { message: 'falhou no banco' };
    expect(await salvarUsuario(BIA, formulario({}))).toEqual({ ok: false, erros: { geral: 'falhou no banco' } });
  });
});
