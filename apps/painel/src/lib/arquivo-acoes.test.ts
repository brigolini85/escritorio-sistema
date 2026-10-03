// apps/painel/src/lib/arquivo-acoes.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Server actions do arquivo com a sessão, o Supabase e o Auth falsos (sem banco). O banco confere de novo (pgTAP).
const falso = vi.hoisted(() => ({
  usuario: { id: 'u1', nome: 'Bia', papel: 'atendente' as 'admin' | 'atendente', permissoes: ['editar_clientes'], setores: [] as string[], tamanhoLetra: 'normal' },
  rpc: vi.fn(),
  deleteUser: vi.fn(),
  revalidatePath: vi.fn(),
  ordem: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: falso.revalidatePath }));
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => ({ rpc: falso.rpc }) }));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({ auth: { admin: { deleteUser: falso.deleteUser } } }) }));
vi.mock('@/lib/sessao', () => ({
  obterUsuario: async () => falso.usuario,
  temPermissao: (u: { papel: string; permissoes: string[] }, p: string) => u.papel === 'admin' || u.permissoes.includes(p),
}));

import { arquivarCadastro, consultarUso, excluirCadastroDeVez, restaurarCadastro } from './arquivo-acoes';

const ID = '11111111-1111-4111-8111-111111111111';
const admin = () => { falso.usuario = { ...falso.usuario, papel: 'admin', permissoes: [] }; };

beforeEach(() => {
  falso.usuario = { id: 'u1', nome: 'Bia', papel: 'atendente', permissoes: ['editar_clientes'], setores: [], tamanhoLetra: 'normal' };
  falso.ordem = [];
  falso.rpc.mockReset().mockImplementation(async (nome: string) => { falso.ordem.push(nome); return { data: null, error: null }; });
  falso.deleteUser.mockReset().mockImplementation(async () => { falso.ordem.push('deleteUser'); return { error: null }; });
  falso.revalidatePath.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('arquivo: permissões antes do banco', () => {
  it('quem tem Editar clientes arquiva e restaura pelo banco e as telas atualizam', async () => {
    expect(await arquivarCadastro('cliente', ID)).toEqual({ ok: true });
    expect(falso.rpc).toHaveBeenCalledWith('arquivar_cadastro', { p_tipo: 'cliente', p_id: ID });
    expect(falso.revalidatePath).toHaveBeenCalledWith('/clientes', 'layout');
    expect(await restaurarCadastro('contato', ID)).toEqual({ ok: true });
    expect(falso.rpc).toHaveBeenCalledWith('restaurar_cadastro', { p_tipo: 'contato', p_id: ID });
    expect(falso.revalidatePath).toHaveBeenCalledWith('/contatos', 'layout');
  });

  it('sem Editar clientes não chama o banco', async () => {
    falso.usuario = { ...falso.usuario, permissoes: [] };
    const recusa = { ok: false, erro: 'Sem permissão para arquivar cadastros.' };
    expect(await arquivarCadastro('cliente', ID)).toEqual(recusa);
    expect(await restaurarCadastro('produto', ID)).toEqual(recusa);
    expect(await consultarUso('rede', ID)).toEqual(recusa);
    expect(falso.rpc).not.toHaveBeenCalled();
  });

  it('só o administrador arquiva pessoas e exclui de vez', async () => {
    expect(await arquivarCadastro('usuario', ID)).toEqual({ ok: false, erro: 'Só o administrador arquiva pessoas.' });
    expect(await excluirCadastroDeVez('cliente', ID)).toEqual({ ok: false, erro: 'Só o administrador exclui de vez.' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });

  it('tipo ou id estranho não chega ao banco', async () => {
    expect(await arquivarCadastro('banana' as never, ID)).toEqual({ ok: false, erro: 'Cadastro inválido.' });
    expect(await arquivarCadastro('cliente', 'x')).toEqual({ ok: false, erro: 'Cadastro inválido.' });
    expect(falso.rpc).not.toHaveBeenCalled();
  });
});

describe('arquivo: banco e Auth', () => {
  it('consultarUso devolve o uso lido e se a pessoa é administradora', async () => {
    falso.rpc.mockResolvedValueOnce({ data: { contagens: { demandas: 1 }, abertas: [7] }, error: null });
    expect(await consultarUso('cliente', ID)).toEqual({ ok: true, uso: { contagens: { demandas: 1 }, abertas: [7] }, admin: false });
    expect(falso.rpc).toHaveBeenCalledWith('uso_do_cadastro', { p_tipo: 'cliente', p_id: ID });
  });

  it('recusa do banco aparece na tela (o cadastro ganhou histórico depois da janela abrir) e o login não é tocado', async () => {
    admin();
    falso.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.' } });
    expect(await excluirCadastroDeVez('usuario', ID)).toEqual({ ok: false, erro: 'Este cadastro tem histórico e não pode ser excluído de vez. Arquive.' });
    expect(falso.deleteUser).not.toHaveBeenCalled();
  });

  it('excluir pessoa: primeiro o banco confere e apaga, depois sai do login', async () => {
    admin();
    expect(await excluirCadastroDeVez('usuario', ID)).toEqual({ ok: true });
    expect(falso.ordem).toEqual(['excluir_cadastro_definitivo', 'deleteUser']);
    expect(falso.deleteUser).toHaveBeenCalledWith(ID);
    expect(falso.revalidatePath).toHaveBeenCalledWith('/usuarios', 'layout');
  });

  it('excluir outro cadastro não mexe no login', async () => {
    admin();
    expect(await excluirCadastroDeVez('produto', ID)).toEqual({ ok: true });
    expect(falso.deleteUser).not.toHaveBeenCalled();
  });

  it('login que não sai vira aviso', async () => {
    admin();
    falso.deleteUser.mockResolvedValueOnce({ error: { message: 'User not found' } });
    expect(await excluirCadastroDeVez('usuario', ID)).toEqual({ ok: false, erro: 'Saiu do painel, mas o login não foi removido: User not found' });
  });
});

describe('restaurar unidade', () => {
  it('rede arquivada: devolve a pergunta e não atualiza as telas', async () => {
    falso.rpc.mockResolvedValueOnce({ data: { restaurada: false, rede_arquivada: { id: 'r1', nome: 'Rede A', tipo: 'cliente' } }, error: null });
    expect(await restaurarCadastro('unidade', ID)).toEqual({ ok: false, redeArquivada: { id: 'r1', nome: 'Rede A', tipo: 'cliente' } });
    expect(falso.rpc).toHaveBeenCalledWith('restaurar_unidade', { p_id: ID, p_com_rede: false });
    expect(falso.revalidatePath).not.toHaveBeenCalled();
  });
  it('com o sim, restaura as duas e atualiza a ficha', async () => {
    falso.rpc.mockResolvedValueOnce({ data: { restaurada: true, rede_restaurada: true }, error: null });
    expect(await restaurarCadastro('unidade', ID, { comRede: true })).toEqual({ ok: true });
    expect(falso.rpc).toHaveBeenCalledWith('restaurar_unidade', { p_id: ID, p_com_rede: true });
    expect(falso.revalidatePath).toHaveBeenCalledWith('/clientes', 'layout');
  });
  it('os outros tipos restauram como antes', async () => {
    expect(await restaurarCadastro('rede', ID, { comRede: true })).toEqual({ ok: true });
    expect(falso.rpc).toHaveBeenCalledWith('restaurar_cadastro', { p_tipo: 'rede', p_id: ID });
  });
});
