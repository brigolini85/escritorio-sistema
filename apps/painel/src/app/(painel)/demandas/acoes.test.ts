import { beforeEach, describe, expect, it, vi } from 'vitest';

// As ações do painel lateral só repassam ao banco; aqui: validação antes do banco e mensagem do banco na língua da tela.
const falso = vi.hoisted(() => ({
  chamadas: [] as { nome: string; args: unknown }[], erro: null as string | null,
  leituras: [] as { tabela: string; coluna: string; valor: unknown }[], falhaLeitura: false,
  atual: { titulo: 'Título do banco', resumo: 'Texto do banco', contato_id: '33333333-3333-4333-8333-333333333333' } as { titulo: string; resumo: string; contato_id: string | null; pedido_venda?: unknown } | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const sessao = vi.hoisted(() => ({ prazos: 'sim' as 'sim' | 'nao', notas: 'ver' as 'sem_acesso' | 'ver' | 'corrigir' }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'atendente', niveis: { prazos: sessao.prazos, notas: sessao.notas } }) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    from: (tabela: string) => ({ select: () => ({ eq: (coluna: string, valor: unknown) => {
      falso.leituras.push({ tabela, coluna, valor });
      return { maybeSingle: async () => (falso.falhaLeitura ? { data: null, error: { message: 'fetch failed' } } : { data: falso.atual, error: null }) };
    } }) }),
    rpc: async (nome: string, args: unknown) => {
      falso.chamadas.push({ nome, args });
      return { data: null, error: falso.erro ? { message: falso.erro } : null };
    },
  }),
}));

import { alterarStatusDemanda, criarDemanda, definirPrazo, editarDemanda, definirPrioridade, notaInternaDemanda, transferirDemanda } from './acoes';

const ID = '22222222-2222-4222-8222-222222222222';
beforeEach(() => {
  falso.chamadas = []; falso.erro = null; falso.leituras = []; falso.falhaLeitura = false;
  sessao.prazos = 'sim'; sessao.notas = 'ver';
  falso.atual = { titulo: 'Título do banco', resumo: 'Texto do banco', contato_id: '33333333-3333-4333-8333-333333333333' };
});

describe('ações da demanda', () => {
  it('status e prioridade: aviso com o nome da tela', async () => {
    expect(await alterarStatusDemanda(ID, 'aguardando_cliente')).toEqual({ ok: true, mensagem: 'Status: Com o cliente.' });
    expect(await definirPrioridade(ID, 'urgente')).toEqual({ ok: true, mensagem: 'Prioridade Urgente. Prazo recalculado.' });
    expect(falso.chamadas).toEqual([
      { nome: 'alterar_status_chamado', args: { p_chamado: ID, p_status: 'aguardando_cliente' } },
      { nome: 'definir_prioridade_prazo', args: { p_chamado: ID, p_prioridade: 'urgente' } },
    ]);
  });
  it('prazo do campo vira ISO em Brasília; campo vazio não chega ao banco', async () => {
    expect(await definirPrazo(ID, '2026-10-13T18:00')).toEqual({ ok: true, mensagem: 'Prazo alterado.' });
    expect(falso.chamadas[0]).toEqual({ nome: 'definir_prioridade_prazo', args: { p_chamado: ID, p_prazo: '2026-10-13T21:00:00.000Z' } });
    expect(await definirPrazo(ID, '')).toEqual({ ok: false, erro: 'Escolha a data e a hora do prazo.' });
    expect(falso.chamadas).toHaveLength(1);
  });
  it('nota vazia e transferir sem setor param antes do banco', async () => {
    expect(await notaInternaDemanda(ID, '   ')).toEqual({ ok: false, erro: 'Escreva a nota.' });
    expect(await transferirDemanda(ID, '', null)).toEqual({ ok: false, erro: 'Escolha o setor.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('editar sempre manda o contato (o banco trata nulo como remover): título e descrição nunca o apagam', async () => {
    const C = '33333333-3333-4333-8333-333333333333';
    await editarDemanda(ID, { titulo: 'Novo título' });
    await editarDemanda(ID, { descricao: 'Nova descrição', contato: null });
    await editarDemanda(ID, { descricao: 'Outra', contato: '44444444-4444-4444-8444-444444444444' });
    expect(falso.chamadas).toEqual([
      // só o título mudou: descrição e contato atuais voltam do banco, o contato nunca vai vazio
      { nome: 'editar_demanda', args: { p_chamado: ID, p_titulo: 'Novo título', p_descricao: 'Texto do banco', p_contato: C } },
      // remover o contato só quando a pessoa escolhe "Nenhum" (null explícito)
      { nome: 'editar_demanda', args: { p_chamado: ID, p_titulo: 'Título do banco', p_descricao: 'Nova descrição', p_contato: null } },
      { nome: 'editar_demanda', args: { p_chamado: ID, p_titulo: 'Título do banco', p_descricao: 'Outra', p_contato: '44444444-4444-4444-8444-444444444444' } },
    ]);
  });
  it('editar demanda que não aparece (sem acesso) não chega ao banco', async () => {
    falso.atual = null;
    expect(await editarDemanda(ID, { titulo: 'X' })).toEqual({ ok: false, erro: 'Você não tem acesso a esta demanda.' });
    expect(falso.chamadas).toEqual([]);
    expect(falso.leituras).toEqual([{ tabela: 'chamados', coluna: 'id', valor: ID }]);
  });
  it('falha ao ler a demanda não vira "sem acesso"', async () => {
    falso.falhaLeitura = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await editarDemanda(ID, { titulo: 'X' })).toEqual({ ok: false, erro: 'Não consegui salvar agora. Tente de novo.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('sem "Alterar prazos" o prazo à mão é recusado antes do banco (P10)', async () => {
    sessao.prazos = 'nao';
    expect(await definirPrazo(ID, '2026-10-13T18:00')).toEqual({ ok: false, erro: 'Você não tem permissão para alterar prazos.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('sem "Alterar prazos" a nova demanda com prazo escolhido é recusada; sem prazo, o banco calcula (P10)', async () => {
    sessao.prazos = 'nao';
    const nova = { cliente: 'c1', setor: 's1', titulo: 'Folha de outubro', descricao: '', prioridade: 'normal' as const, prazo: '2026-10-13T18:00', responsavel: '', contato: '' };
    expect(await criarDemanda(nova)).toEqual({ ok: false, erro: 'Você não tem permissão para alterar prazos.', campo: 'prazo' });
    expect(falso.chamadas).toEqual([]);
    falso.erro = 'Setor não encontrado.'; // o falso não devolve a demanda criada: basta ver o que chegou ao banco
    await criarDemanda({ ...nova, prazo: '' });
    expect(falso.chamadas).toEqual([{ nome: 'criar_demanda', args: expect.objectContaining({ p_prazo: null }) }]);
  });
  it('"Pedidos de nota: Sem acesso" não muda a descrição de um pedido de nota (P11); título e contato, sim', async () => {
    sessao.notas = 'sem_acesso';
    falso.atual = { titulo: 'NF de Padaria', resumo: 'Itens: 10 pães R$ 5,00', contato_id: null, pedido_venda: null };
    expect(await editarDemanda(ID, { descricao: 'Nova' })).toEqual({ ok: false, erro: 'Você não tem acesso a pedidos de nota.' });
    expect(falso.chamadas).toEqual([]);
    await editarDemanda(ID, { titulo: 'Outro título', contato: null });
    expect(falso.chamadas).toEqual([{ nome: 'editar_demanda', args: { p_chamado: ID, p_titulo: 'Outro título', p_descricao: 'Itens: 10 pães R$ 5,00', p_contato: null } }]);
  });
  it('erro do banco volta na língua da tela', async () => {
    falso.erro = 'sem acesso a este chamado';
    expect(await notaInternaDemanda(ID, 'Cliente ligou')).toEqual({ ok: false, erro: 'Você não tem acesso a esta demanda.' });
    falso.erro = 'A demanda já está com Ana.';
    expect(await alterarStatusDemanda(ID, 'em_andamento')).toEqual({ ok: false, erro: 'A demanda já está com Ana.' });
  });
});
