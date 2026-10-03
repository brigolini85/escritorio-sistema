import { beforeEach, describe, expect, it, vi } from 'vitest';

// A ficha devolve o resultado para a tela (erro no campo, nada se perde) e grava tudo numa função do banco.
const falso = vi.hoisted(() => ({
  rpcs: [] as { nome: string; args: Record<string, unknown> }[],
  erroRpc: null as { message: string } | null,
  donos: [] as { id: string; nome: string; ativo: boolean }[],
  apagados: [] as string[],
  convites: [] as string[],
  links: [] as string[],
  jaEntrou: false,
  erroConvite: null as { message: string } | null,
  erroApagar: null as { message: string } | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ exigirAdmin: async () => ({ id: 'adm', papel: 'admin' }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: Record<string, unknown>) => { falso.rpcs.push({ nome, args }); return { error: falso.erroRpc }; },
  }),
}));
vi.mock('@/lib/supabase/servico', () => ({
  supabaseServico: () => ({
    from: () => ({ select: () => ({ in: async () => ({ data: falso.donos }) }) }),
    auth: {
      admin: {
        inviteUserByEmail: async (email: string) => {
          falso.convites.push(email);
          return falso.erroConvite ? { data: { user: null }, error: falso.erroConvite } : { data: { user: { id: 'nova' } }, error: null };
        },
        deleteUser: async (id: string) => { falso.apagados.push(id); return { error: falso.erroApagar }; },
        getUserById: async () => ({ data: { user: { email: 'bia@escritorio.com', last_sign_in_at: falso.jaEntrou ? '2026-10-01T10:00:00Z' : null } }, error: null }),
      },
      resetPasswordForEmail: async (email: string) => { falso.links.push(email); return { error: null }; },
    },
  }),
}));

import { convidarUsuario, reenviarConvite, salvarUsuario } from './acoes';

const BIA = '11111111-1111-4111-8111-111111111111';
function form(campos: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ nome: 'Bia Souza', email: 'bia@escritorio.com', papel: 'atendente', horario_restrito: 'nao', ...campos })) {
    for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  }
  return f;
}

beforeEach(() => {
  Object.assign(falso, { rpcs: [], erroRpc: null, donos: [], apagados: [], convites: [], links: [], jaEntrou: false, erroConvite: null, erroApagar: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('salvarUsuario', () => {
  it('grava pela função do banco e devolve o id', async () => {
    expect(await salvarUsuario(BIA, form({ nivel_demandas: 'minhas' }))).toEqual({ ok: true, id: BIA });
    expect(falso.rpcs).toEqual([{ nome: 'salvar_usuario', args: { p_id: BIA, p_dados: expect.objectContaining({
      nome: 'Bia Souza', papel: 'atendente', niveis: { demandas: 'minhas' }, horario_acesso: null }) } }]);
  });
  it('telefone inválido: erro no campo e nada gravado', async () => {
    expect(await salvarUsuario(BIA, form({ telefone: '12345' }))).toEqual({ ok: false, erros: { telefone: 'Telefone inválido' } });
    expect(falso.rpcs).toEqual([]);
  });
  it('telefone de outra pessoa ou de arquivada: como na Parte B', async () => {
    falso.donos = [{ id: 'outra', nome: 'Zé', ativo: true }];
    expect(await salvarUsuario(BIA, form({ telefone: '(31) 99999-1801' }))).toEqual({ ok: false, erros: { telefone: 'Este telefone já é de Zé.' } });
    falso.donos = [{ id: 'ze', nome: 'Zé', ativo: false }];
    expect(await salvarUsuario(BIA, form({ telefone: '(31) 99999-1801' }))).toEqual({
      ok: false, erros: { telefone: 'Este telefone é de Zé, que está nos arquivados. Restaure Zé ou use outro telefone.' },
      telefoneDeArquivado: { id: 'ze', nome: 'Zé' },
    });
  });
  it('recusa do banco vai para o campo', async () => {
    falso.erroRpc = { message: 'Você não pode tirar o seu próprio acesso de administrador.' };
    expect(await salvarUsuario(BIA, form({}))).toEqual({ ok: false, erros: { papel: 'Você não pode tirar o seu próprio acesso de administrador.' } });
  });
  it('id fora do formato: aviso geral e nada gravado', async () => {
    expect(await salvarUsuario('x', form({}))).toEqual({ ok: false, erros: { geral: 'Não encontrei o acesso desta pessoa. Volte à lista e abra a ficha de novo.' } });
    expect(falso.rpcs).toEqual([]);
  });
});

describe('convidarUsuario', () => {
  it('convida e grava a ficha', async () => {
    expect(await convidarUsuario(form({}))).toEqual({ ok: true, id: 'nova' });
    expect(falso.convites).toEqual(['bia@escritorio.com']);
    expect(falso.rpcs[0]!.args.p_id).toBe('nova');
  });
  it('ficha recusada: apaga o login do convite (senão o e-mail ficaria preso)', async () => {
    falso.erroRpc = { message: 'Setor não encontrado.' };
    expect(await convidarUsuario(form({}))).toEqual({ ok: false, erros: { geral: 'Setor não encontrado.' } });
    expect(falso.apagados).toEqual(['nova']);
  });
  it('erro do convite em inglês não chega à tela: texto fixo e registro do original', async () => {
    falso.erroConvite = { message: 'Email rate limit exceeded' };
    expect(await convidarUsuario(form({}))).toEqual({ ok: false, erros: { geral: 'Não consegui enviar o convite agora. Tente de novo em alguns minutos.' } });
    expect(falso.rpcs).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[usuarios]'), 'Email rate limit exceeded');
  });
  it('login do convite que não apaga fica registrado', async () => {
    falso.erroRpc = { message: 'Setor não encontrado.' };
    falso.erroApagar = { message: 'User not found' };
    await convidarUsuario(form({}));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('apagar o login'), 'nova', 'User not found');
  });
});

describe('reenviarConvite', () => {
  it('quem nunca entrou recebe o convite de novo', async () => {
    expect(await reenviarConvite(BIA)).toEqual({ ok: true, mensagem: 'Convite reenviado para bia@escritorio.com.' });
    expect(falso.convites).toEqual(['bia@escritorio.com']);
  });
  it('convite recusado: registra o erro e manda o link para criar a senha', async () => {
    falso.erroConvite = { message: 'Email rate limit exceeded' };
    expect(await reenviarConvite(BIA)).toEqual({ ok: true, mensagem: 'Enviamos para bia@escritorio.com um link para criar a senha.' });
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[usuarios]'), 'Email rate limit exceeded');
  });
  it('quem já entrou recebe o link para criar a senha', async () => {
    falso.jaEntrou = true;
    expect(await reenviarConvite(BIA)).toEqual({ ok: true, mensagem: 'Enviamos para bia@escritorio.com um link para criar a senha.' });
    expect(falso.links).toEqual(['bia@escritorio.com']);
  });
});
