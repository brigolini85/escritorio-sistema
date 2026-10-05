import { describe, expect, it, vi } from 'vitest';
import { NIVEIS_PADRAO } from '@escritorio/core';

vi.mock('server-only', () => ({}));
const { THIAGO_SEM_MIGRACAO, acessoAosAgentes, lerAgentes, lerContagens, lerLinhaAgente, lerNumeros, podeTreinarAgente, semMigracaoI1, souDono } = await import('./agentes');

const FIS = '33333333-3333-4333-8333-333333333333';
const u = (papel: 'admin' | 'atendente', treinar: 'nao' | 'sim', setores: string[] = []) =>
  ({ papel, niveis: { ...NIVEIS_PADRAO, treinar }, setores });
const linha = {
  id: 'a1', slug: 'fiscal', nome: 'Agente Fiscal', descricao: 'notas e guias', setor_id: FIS, tipos: ['conversa', 'trabalho'], estado: 'teste',
  modelo: null, modo_contato: 'mesma_voz', ferramentas: ['responder'], porta_de_entrada: false, criado_em: '2026-09-12T12:00:00Z',
  atualizado_em: '2026-09-30T12:00:00Z', setores: { nome: 'Fiscal' }, atualizador: { nome: 'Thiago' },
};

describe('leitura dos agentes (D23)', () => {
  it('linha do banco vira Agente; valores estranhos viram o mais seguro', () => {
    expect(lerLinhaAgente(linha)).toEqual({ id: 'a1', slug: 'fiscal', nome: 'Agente Fiscal', descricao: 'notas e guias', setorId: FIS, setor: 'Fiscal',
      tipos: ['conversa', 'trabalho'], estado: 'teste', modelo: null, modoContato: 'mesma_voz', ferramentas: ['responder'], portaDeEntrada: false,
      criadoEm: '2026-09-12T12:00:00Z', atualizadoEm: '2026-09-30T12:00:00Z', atualizadoPor: 'Thiago' });
    expect(lerLinhaAgente({ ...linha, estado: 'xyz', modo_contato: 'outro', tipos: ['nada'] })).toMatchObject({ estado: 'desligado', modoContato: null, tipos: ['conversa'] });
  });
  it('banco sem a Parte I: só o Thiago do código, sem erro', async () => {
    const sb = { from: () => ({ select: () => ({ order: async () => ({ data: null, error: { code: '42P01', message: 'relation does not exist' } }) }) }) };
    expect(await lerAgentes(sb as never)).toEqual({ agentes: [THIAGO_SEM_MIGRACAO], semMigracao: true, erro: false });
    expect(semMigracaoI1({ code: 'PGRST205' })).toBe(true);
    expect(semMigracaoI1({ code: '23505' })).toBe(false);
  });
  it('outro erro: lista vazia com erro (a tela avisa), nunca "sem migração"', async () => {
    const sb = { from: () => ({ select: () => ({ order: async () => ({ data: null, error: { code: '57014', message: 'timeout' } }) }) }) };
    expect(await lerAgentes(sb as never)).toEqual({ agentes: [], semMigracao: false, erro: true });
  });
});

describe('quem vê e quem mexe (D12)', () => {
  it('ver: administrador, dono ou Treinar o agente; números: dono e administrador', () => {
    expect(acessoAosAgentes(u('atendente', 'nao'), false)).toEqual({ ver: false, dono: false, numeros: false });
    expect(acessoAosAgentes(u('atendente', 'sim'), false)).toEqual({ ver: true, dono: false, numeros: false });
    expect(acessoAosAgentes(u('admin', 'nao'), false)).toEqual({ ver: true, dono: false, numeros: true });
    expect(acessoAosAgentes(u('admin', 'nao'), true)).toEqual({ ver: true, dono: true, numeros: true });
  });
  it('orientações: o Thiago com Treinar o agente; os outros também pelo setor', () => {
    const fiscal = { portaDeEntrada: false, setorId: FIS };
    expect(podeTreinarAgente(u('atendente', 'sim'), THIAGO_SEM_MIGRACAO)).toBe(true);
    expect(podeTreinarAgente(u('atendente', 'sim'), fiscal)).toBe(false);
    expect(podeTreinarAgente(u('atendente', 'sim', [FIS]), fiscal)).toBe(true);
    expect(podeTreinarAgente(u('admin', 'nao'), fiscal)).toBe(true);
    expect(podeTreinarAgente(u('atendente', 'nao', [FIS]), fiscal)).toBe(false);
  });
});

describe('contagens e volta sem a migração (F13, F14)', () => {
  const pagina = (r: { data: unknown; error: unknown }) => ({ order: () => ({ range: async () => r }), is: () => ({ order: () => ({ range: async () => r }) }) });
  const agentes = [THIAGO_SEM_MIGRACAO, lerLinhaAgente(linha)];
  it('conta por agente lendo as linhas (GET), sem head', async () => {
    const sb = { from: (t: string) => ({ select: (c: string, o?: unknown) => {
      expect(o).toBeUndefined();
      return pagina({ data: t === 'agente_skills' ? [{ agente_id: 'a1' }, { agente_id: 'a1' }] : [{ agente_id: THIAGO_SEM_MIGRACAO.id }], error: null });
    } }) };
    const m = await lerContagens(sb as never, agentes);
    expect(m.get('a1')).toEqual({ skills: 2, ferramentas: 1, orientacoes: 0 });
    expect(m.get(THIAGO_SEM_MIGRACAO.id)?.orientacoes).toBe(1);
  });
  it('sem a migração: zeros, sem erro no console', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const sb = { from: () => ({ select: () => pagina({ data: null, error: { code: '42P01', message: 'x' } }) }) };
    expect((await lerContagens(sb as never, agentes)).get('a1')).toEqual({ skills: 0, ferramentas: 1, orientacoes: 0 });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it('rpc sem a função: números nulos, dono falso (códigos 42883 e PGRST202)', async () => {
    for (const code of ['42883', 'PGRST202']) {
      const sb = { rpc: async () => ({ data: null, error: { code, message: 'x' } }) };
      expect(await lerNumeros(sb as never, '2026-10-01', '2026-11-01')).toBeNull();
      expect(await souDono(sb as never)).toBe(false);
    }
  });
});
