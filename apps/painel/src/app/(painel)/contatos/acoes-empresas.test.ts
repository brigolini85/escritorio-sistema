import { beforeEach, describe, expect, it, vi } from 'vitest';

// Parte G3 (spec 7C.2, D9, D10): marcações por empresa e vincular empresa pelo painel do contato, com a permissão de hoje.
const falso = vi.hoisted(() => ({
  nivel: 'editar' as 'ver' | 'editar',
  contatoAtivo: true as boolean | null,
  empresaAtiva: true as boolean | null,
  atualizadas: [{ cliente_id: 'e' }] as { cliente_id: string }[],
  erroInsert: null as { code: string; message: string } | null,
  gravado: [] as [string, string, unknown][],
  revalidados: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'atendente', niveis: { clientes: falso.nivel } }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    from: (tabela: string) => {
      const ativo = tabela === 'contatos' ? falso.contatoAtivo : falso.empresaAtiva;
      const cadeia = {
        select: () => cadeia,
        eq: () => cadeia,
        maybeSingle: async () => ({ data: ativo === null ? null : { ativo }, error: null }),
        update: (dados: unknown) => {
          falso.gravado.push(['update', tabela, dados]);
          return { eq: () => ({ eq: () => ({ select: async () => ({ data: falso.atualizadas, error: null }) }) }) };
        },
        insert: async (dados: unknown) => {
          falso.gravado.push(['insert', tabela, dados]);
          return { error: falso.erroInsert };
        },
      };
      return cadeia;
    },
  }),
}));

const { marcarEmpresaDoContato, vincularEmpresaAoContato } = await import('./acoes');

const C = '11111111-1111-4111-8111-111111111111';
const E = '22222222-2222-4222-8222-222222222222';
const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
};
const SEM_PERMISSAO = { ok: false, erro: 'Você não tem permissão para editar contatos.' };

beforeEach(() => {
  Object.assign(falso, { nivel: 'editar', contatoAtivo: true, empresaAtiva: true, atualizadas: [{ cliente_id: E }], erroInsert: null, gravado: [], revalidados: [] });
});

describe('marcarEmpresaDoContato', () => {
  it('grava só a marcação pedida e revalida Contatos e a ficha da empresa', async () => {
    expect(await marcarEmpresaDoContato(C, E, 'pode_pedir_nota', true)).toEqual({ ok: true });
    expect(falso.gravado).toEqual([['update', 'contato_clientes', { pode_pedir_nota: true }]]);
    expect(falso.revalidados).toEqual(expect.arrayContaining(['/contatos', `/clientes/${E}`]));
  });
  it('"Só ver": recusa sem gravar (a mesma permissão de hoje)', async () => {
    falso.nivel = 'ver';
    expect(await marcarEmpresaDoContato(C, E, 'pode_atualizar_preco', true)).toEqual(SEM_PERMISSAO);
    expect(falso.gravado).toEqual([]);
  });
  it('campo ou valor estranho vindo do navegador: recusa', async () => {
    expect(await marcarEmpresaDoContato(C, E, 'ativo' as never, true)).toEqual({ ok: false, erro: 'Marcação inválida.' });
    expect(await marcarEmpresaDoContato(C, E, 'pode_pedir_nota', 'sim' as never)).toEqual({ ok: false, erro: 'Marcação inválida.' });
    expect(falso.gravado).toEqual([]);
  });
  it('contato arquivado: recusa; vínculo que sumiu: avisa', async () => {
    falso.contatoAtivo = false;
    expect(await marcarEmpresaDoContato(C, E, 'pode_pedir_nota', true)).toEqual({ ok: false, erro: 'Contato arquivado: restaure antes de mudar as marcações.' });
    expect(falso.gravado).toEqual([]);
    falso.contatoAtivo = true;
    falso.atualizadas = [];
    expect(await marcarEmpresaDoContato(C, E, 'pode_pedir_nota', true)).toEqual({ ok: false, erro: 'Este contato não está mais ligado a esta empresa.' });
  });
});

describe('vincularEmpresaAoContato', () => {
  it('liga a empresa com as marcações escolhidas', async () => {
    expect(await vincularEmpresaAoContato(C, form({ cliente_id: E, pode_atualizar_preco: 'on' }))).toEqual({ ok: true });
    expect(falso.gravado).toEqual([['insert', 'contato_clientes', { contato_id: C, cliente_id: E, pode_pedir_nota: false, pode_atualizar_preco: true }]]);
    expect(falso.revalidados).toEqual(expect.arrayContaining(['/contatos', `/clientes/${E}`]));
  });
  it('sem empresa, empresa arquivada, contato arquivado ou já ligada: mensagem clara (nunca sobrescreve, D10)', async () => {
    expect(await vincularEmpresaAoContato(C, form({}))).toEqual({ ok: false, erro: 'Escolha a empresa.' });
    falso.empresaAtiva = false;
    expect(await vincularEmpresaAoContato(C, form({ cliente_id: E }))).toEqual({ ok: false, erro: 'Empresa arquivada ou inexistente: escolha outra.' });
    falso.empresaAtiva = true;
    falso.contatoAtivo = false;
    expect(await vincularEmpresaAoContato(C, form({ cliente_id: E }))).toEqual({ ok: false, erro: 'Contato arquivado: restaure antes de vincular empresas.' });
    expect(falso.gravado).toEqual([]);
    falso.contatoAtivo = true;
    falso.erroInsert = { code: '23505', message: 'duplicate key value violates unique constraint' };
    expect(await vincularEmpresaAoContato(C, form({ cliente_id: E }))).toEqual({ ok: false, erro: 'Este contato já está ligado a esta empresa.' });
  });
  it('erro cru do Postgres não chega à tela', async () => {
    falso.erroInsert = { code: '42501', message: 'new row violates row-level security policy for table "contato_clientes"' };
    const r = await vincularEmpresaAoContato(C, form({ cliente_id: E }));
    expect(r).toEqual({ ok: false, erro: 'Não foi possível salvar agora. Tente de novo.' });
  });
  it('"Só ver": recusa', async () => {
    falso.nivel = 'ver';
    expect(await vincularEmpresaAoContato(C, form({ cliente_id: E }))).toEqual(SEM_PERMISSAO);
    expect(falso.gravado).toEqual([]);
  });
});
