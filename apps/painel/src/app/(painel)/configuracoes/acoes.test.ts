import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ações de Configurações com a sessão e o Supabase falsos (sem banco): só os caminhos de erro das sobras da revisão.
const falso = vi.hoisted(() => ({
  respostas: vi.fn(),   // resultado do update de respostas_prontas (.select('id') no fim)
  config: vi.fn(),      // resultado da leitura de configuracoes
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/lib/sessao', () => ({ exigirAdmin: async () => ({}), exigirConfiguracoes: async () => ({}) }));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({}) }));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({
    from: (tabela: string) => tabela === 'respostas_prontas'
      ? { update: () => ({ eq: () => ({ select: falso.respostas }) }), insert: falso.respostas }
      : { select: () => ({ eq: () => ({ single: falso.config }) }), update: () => ({ eq: async () => ({ error: null }) }) },
  }),
}));

import { salvarModelos, salvarResposta } from './acoes';

const ID = '11111111-1111-4111-8111-111111111111';
function form(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}

beforeEach(() => {
  falso.respostas.mockReset();
  falso.config.mockReset();
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
