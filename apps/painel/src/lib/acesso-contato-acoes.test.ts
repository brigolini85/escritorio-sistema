import { beforeEach, describe, expect, it, vi } from 'vitest';
import { marcasBasicas, marcasDoPerfil, setoresDisponiveis } from '@escritorio/core';

// Parte H2 (D6, D23): salvar o bloco grava numa chamada; o perfil é recalculado no servidor; a permissão é a de hoje.
const C = '11111111-1111-4111-8111-111111111111';
const E = '22222222-2222-4222-8222-222222222222';
const FIS = '33333333-3333-4333-8333-333333333333';
const PES = '44444444-4444-4444-8444-444444444444';
const falso = vi.hoisted(() => ({
  nivel: 'editar' as 'ver' | 'editar',
  erroRpc: null as { code: string; message: string } | null,
  chamadas: [] as [string, unknown][],
  revalidados: [] as string[],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'atendente', niveis: { clientes: falso.nivel } }) }));
vi.mock('@/lib/acesso-contato', () => ({
  lerDisponiveis: async () => setoresDisponiveis([
    { id: FIS, nome: 'Fiscal', descricao_assuntos: '' }, { id: PES, nome: 'Pessoal', descricao_assuntos: '' },
  ], [FIS, PES], []).setores,
}));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: async (nome: string, args: unknown) => { falso.chamadas.push([nome, args]); return { data: null, error: falso.erroRpc }; },
  }),
}));
const { salvarAcessoContato } = await import('./acesso-contato-acoes');
const disponiveis = setoresDisponiveis([{ id: FIS, nome: 'Fiscal', descricao_assuntos: '' }, { id: PES, nome: 'Pessoal', descricao_assuntos: '' }], [FIS, PES], []).setores;

beforeEach(() => { Object.assign(falso, { nivel: 'editar', erroRpc: null, chamadas: [], revalidados: [] }); });

describe('salvarAcessoContato', () => {
  it('grava numa chamada, com o perfil recalculado das marcações', async () => {
    const r = await salvarAcessoContato(C, E, { marcas: marcasDoPerfil('compras_vendas', disponiveis), contato: { nome: 'Carla Mendes', cargo: 'Compras', email: 'carla@bompreco.com.br' } });
    expect(r).toEqual({ ok: true, perfil: 'compras_vendas' });
    expect(falso.chamadas).toEqual([['salvar_acesso_contato', { p_contato: C, p_cliente: E, p_dados: {
      perfil: 'compras_vendas', setores: [{ setor_id: FIS, pode_ser_procurado: true }],
      pode_pedir_nota: true, pode_atualizar_preco: true, ver_valores: false, receber_documentos: true,
      avisar_documento_novo: ['whatsapp'], recebe_alertas_acesso: false,
      contato: { nome: 'Carla Mendes', cargo: 'Compras', email: 'carla@bompreco.com.br' },
    } }]]);
    expect(falso.revalidados).toEqual(expect.arrayContaining(['/contatos', `/clientes/${E}`]));
  });
  it('marcações fora de um perfil gravam Personalizado; nada marcado grava Básico', async () => {
    const m = marcasDoPerfil('compras_vendas', disponiveis);
    expect(await salvarAcessoContato(C, E, { marcas: { ...m, setores: [...m.setores, { setorId: PES, podeSerProcurado: false }] } })).toEqual({ ok: true, perfil: 'personalizado' });
    expect(await salvarAcessoContato(C, E, { marcas: marcasBasicas() })).toEqual({ ok: true, perfil: 'basico' });
  });
  it('"Só ver" não grava', async () => {
    falso.nivel = 'ver';
    expect(await salvarAcessoContato(C, E, { marcas: marcasBasicas() })).toEqual({ ok: false, erro: 'Você não tem permissão para editar contatos.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('e-mail inválido e setor que não é uuid são recusados antes do banco', async () => {
    expect(await salvarAcessoContato(C, E, { marcas: marcasBasicas(), contato: { nome: 'Carla', cargo: '', email: 'carla@' } }))
      .toEqual({ ok: false, erro: 'E-mail inválido.' });
    expect(await salvarAcessoContato(C, E, { marcas: { ...marcasBasicas(), setores: [{ setorId: 'x', podeSerProcurado: false }] } }))
      .toMatchObject({ ok: false });
    expect(falso.chamadas).toEqual([]);
  });
  it('frase do banco aparece; erro técnico não', async () => {
    falso.erroRpc = { code: 'P0001', message: 'Contato arquivado: restaure para mudar as marcações.' };
    expect(await salvarAcessoContato(C, E, { marcas: marcasBasicas() })).toEqual({ ok: false, erro: 'Contato arquivado: restaure para mudar as marcações.' });
    falso.erroRpc = { code: '42883', message: 'function x does not exist' };
    expect(await salvarAcessoContato(C, E, { marcas: marcasBasicas() })).toEqual({ ok: false, erro: 'Não foi possível salvar agora. Tente de novo.' });
  });
});
