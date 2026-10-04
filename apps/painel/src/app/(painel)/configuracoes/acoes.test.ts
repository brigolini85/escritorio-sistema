import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ações de Configurações com a sessão e o Supabase falsos (sem banco): só os caminhos de erro das sobras da revisão.
const falso = vi.hoisted(() => ({
  respostas: vi.fn(),   // resultado do update de respostas_prontas (.select('id') no fim)
  config: vi.fn(),      // resultado da leitura de configuracoes
  setor: vi.fn(),       // update de setores (.select('id'))
  rpc: vi.fn(),         // sb.rpc(...)
  feriado: vi.fn(),     // delete de feriados
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ exigirAdmin: async () => ({}), exigirConfiguracoes: async () => ({}) }));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({}) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    rpc: falso.rpc,
    from: (tabela: string) => tabela === 'setores' ? { update: () => ({ eq: () => ({ select: falso.setor }) }) }
      : tabela === 'feriados' ? { delete: () => ({ eq: falso.feriado }) }
      : tabela === 'respostas_prontas'
      ? { update: () => ({ eq: () => ({ select: falso.respostas }) }), insert: falso.respostas }
      : { select: () => ({ eq: () => ({ single: falso.config }) }), update: () => ({ eq: async () => ({ error: null }) }) },
  }),
}));

import { removerFeriado, salvarModelos, salvarResposta, salvarSetor, simularPrazos } from './acoes';

const ID = '11111111-1111-4111-8111-111111111111';
function form(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}

beforeEach(() => {
  falso.respostas.mockReset();
  falso.config.mockReset();
  falso.setor.mockReset();
  falso.rpc.mockReset();
  falso.feriado.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('salvarModelos', () => {
  it('erro ao ler a tabela de preços devolve o erro do banco, não "Escolha um modelo"', async () => {
    falso.config.mockResolvedValue({ data: null, error: { message: 'falha', code: '57014' } });
    const r = await salvarModelos(form({ modelo_agente: 'x', modelo_assistente: 'x', modelo_sugestao: 'x' }));
    expect(r).toEqual({ ok: false, erro: 'Não consegui salvar. Tente de novo.' });
  });
});

describe('salvarResposta (atualizar)', () => {
  const campos = { pergunta: 'Qual o horário?', resposta: 'Das 8 às 18.', ativo: 'on' };
  it('id que não é uuid é recusado sem tocar no banco', async () => {
    const r = await salvarResposta('nao-e-uuid', form(campos));
    expect(r.ok).toBe(false);
    expect(falso.respostas).not.toHaveBeenCalled();
  });
  it('update que não achou a linha avisa que a resposta não existe mais', async () => {
    falso.respostas.mockResolvedValue({ data: [], error: null });
    expect(await salvarResposta(ID, form(campos))).toEqual({ ok: false, erro: 'Essa resposta não existe mais. Recarregue a página.' });
  });
  it('update que achou a linha salva', async () => {
    falso.respostas.mockResolvedValue({ data: [{ id: ID }], error: null });
    expect(await salvarResposta(ID, form(campos))).toEqual({ ok: true, mensagem: 'Resposta pronta salva.' });
  });
});

describe('simularPrazos', () => {
  const prazos = { prazo_urgente_dias: '1', prazo_alta_dias: '3', prazo_normal_dias: '5', prazo_baixa_dias: '10' };
  it('banco sem a migração (PGRST202) segue sem impacto, para salvar só para as novas', async () => {
    falso.config.mockResolvedValue({ data: { prazo_urgente_dias: 2, prazo_alta_dias: 3, prazo_normal_dias: 5, prazo_baixa_dias: 10 }, error: null });
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'x', code: 'PGRST202' } });
    expect(await simularPrazos(form(prazos))).toMatchObject({ ok: true, impactos: [] });
  });
  it('outro erro do RPC continua bloqueando', async () => {
    falso.config.mockResolvedValue({ data: { prazo_urgente_dias: 2, prazo_alta_dias: 3, prazo_normal_dias: 5, prazo_baixa_dias: 10 }, error: null });
    falso.rpc.mockResolvedValue({ data: null, error: { message: 'x', code: '57014' } });
    expect((await simularPrazos(form(prazos))).ok).toBe(false);
  });
});

describe('salvarSetor (atualizar)', () => {
  it('update que não achou a linha avisa que o item não existe mais', async () => {
    falso.setor.mockResolvedValue({ data: [], error: null });
    expect(await salvarSetor(ID, form({ nome: 'Fiscal', descricao_assuntos: '' }))).toEqual({ ok: false, erro: 'Esse item não existe mais. Recarregue a página.' });
  });
});

describe('removerFeriado', () => {
  it('erro do banco vira frase segura, não a mensagem crua do Postgres', async () => {
    falso.feriado.mockResolvedValue({ error: { message: 'relation "x" secret detail', code: '42P01' } });
    await expect(removerFeriado('2026-12-25')).rejects.toThrow('Não consegui remover. Tente de novo.');
  });
});
