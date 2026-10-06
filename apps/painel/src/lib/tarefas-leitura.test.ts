import { beforeEach, describe, expect, it, vi } from 'vitest';

// Revisão geral (painel M1): erro de leitura da tarefa não vira "Não encontrei esta tarefa" nem tarefa sem pendências
// (com APROVAR liberado): a leitura lança e a página mostra a tela de erro com "tentar de novo".
const falso = vi.hoisted(() => ({ erroEm: null as string | null }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/drive', () => ({ lerDriveDaTarefa: async () => null }));
vi.mock('@/lib/agente-demanda', () => ({ rotuloDoAgente: () => 'Agente' }));

import { lerTarefa } from './tarefas';

const LINHA = { id: 't', numero: 1, estado: 'pronta', chamado_id: 'd', chamados: { numero: 1, titulo: 'Folha', pedido_venda: null }, etapas: [], custo_etapas: {} };
function sb() {
  const res = (t: string, data: unknown) => (t === falso.erroEm ? { data: null, error: { code: '57014', message: 'timeout' } } : { data, error: null });
  return {
    from: (t: string) => {
      const q = {
        select: () => q, eq: () => q, order: () => q,
        maybeSingle: async () => res(t, LINHA),
        then: (ok: (v: unknown) => unknown) => Promise.resolve(res(t, [])).then(ok),
      };
      return q;
    },
    rpc: async () => ({ data: [], error: null }),
  } as never;
}
beforeEach(() => { falso.erroEm = null; vi.spyOn(console, 'error').mockImplementation(() => {}); });

describe('lerTarefa com erro do banco', () => {
  it('sem erro: lê a tarefa', async () => {
    expect((await lerTarefa(sb(), 't')).tarefa?.id).toBe('t');
  });
  it.each(['agente_tarefas', 'agente_pendencias', 'agente_tarefa_arquivos', 'agente_tarefa_eventos'])('erro em %s: lança', async (t) => {
    falso.erroEm = t;
    await expect(lerTarefa(sb(), 't')).rejects.toThrow();
  });
});
