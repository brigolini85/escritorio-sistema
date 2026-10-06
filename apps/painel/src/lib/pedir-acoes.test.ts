import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  erro: null as { code: string; message: string } | null, dados: true as unknown, chamadas: [] as [string, unknown][], revalidados: [] as string[],
  enfileiradas: [] as unknown[][],
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'atendente', niveis: {}, setores: [] }) }));
vi.mock('@/lib/fila', () => ({
  enfileirarTarefa: async (...a: unknown[]) => { falso.enfileiradas.push(['tarefa', ...a]); },
  enfileirarPedidoPendencia: async (...a: unknown[]) => { falso.enfileiradas.push(['pedido', ...a]); },
  enfileirarLeituraPasta: async (...a: unknown[]) => { falso.enfileiradas.push(['pasta', ...a]); },
}));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({ rpc: async (nome: string, args: unknown) => { falso.chamadas.push([nome, args]); return { data: falso.dados, error: falso.erro }; } }),
}));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({ storage: { from: () => ({ remove: async () => ({}) }) } }) }));
const acoes = await import('./pedir-acoes');
const A = '11111111-1111-4111-8111-111111111111';
const C = '22222222-2222-4222-8222-222222222222';
const base = { agenteId: A, pedido: 'Conferir as notas', chamadoId: C, clienteId: null, skill: null, prazo: '2026-10-08T12:00', avisarPainel: true,
  avisarWhatsapp: true, lerDrive: true, subpasta: ' Fiscal / 2026-09 ', i4: true };

beforeEach(() => { Object.assign(falso, { erro: null, dados: true, chamadas: [], revalidados: [], enfileiradas: [] }); });

describe('pedirAoAgente (I4)', () => {
  it('chama pedir_ao_agente com o prazo de Brasília e a subpasta limpa; NÃO enfileira (os arquivos vêm antes, D8)', async () => {
    falso.dados = { tarefa_id: A, tarefa_numero: 142, chamado_id: C, chamado_numero: 1058, demanda_nova: false };
    expect(await acoes.pedirAoAgente(base)).toEqual({ ok: true, tarefaId: A, rotulo: 'T-0142', demanda: 1058, demandaNova: false });
    expect(falso.chamadas[0]).toEqual(['pedir_ao_agente', { p_agente: A, p_pedido: 'Conferir as notas', p_chamado: C, p_cliente: null, p_skill: null,
      p_prazo: '2026-10-08T15:00:00.000Z', p_avisar_painel: true, p_avisar_whatsapp: true, p_ler_drive: true, p_subpasta: 'Fiscal/2026-09' }]);
    expect(falso.enfileiradas).toEqual([]);
  });
  it('subpasta inválida e id inválido não chegam ao banco', async () => {
    expect(await acoes.pedirAoAgente({ ...base, subpasta: '../x' })).toEqual({ ok: false, erro: 'Subpasta inválida: use nomes separados por /, até 3 níveis.' });
    expect(await acoes.pedirAoAgente({ ...base, agenteId: 'x' })).toEqual({ ok: false, erro: 'Escolha o agente.' });
    expect(falso.chamadas).toEqual([]);
  });
  it('a frase do banco vai como está', async () => {
    falso.erro = { code: 'P0001', message: 'Você só pede aos agentes dos seus setores.' };
    expect(await acoes.pedirAoAgente(base)).toEqual({ ok: false, erro: 'Você só pede aos agentes dos seus setores.' });
  });
  it('sem a I4 (D17): cria pela função da I3a e enfileira na hora', async () => {
    falso.dados = A;
    expect(await acoes.pedirAoAgente({ ...base, i4: false })).toEqual({ ok: true, tarefaId: A, rotulo: '', demanda: null, demandaNova: false });
    expect(falso.chamadas[0]![0]).toBe('criar_tarefa_agente');
    expect(falso.enfileiradas).toEqual([['tarefa', A]]);
  });
  it('iniciarTarefaPedida enfileira e revalida', async () => {
    await acoes.iniciarTarefaPedida(A);
    expect(falso.enfileiradas).toEqual([['tarefa', A]]);
    expect(falso.revalidados).toContain(`/tarefas/${A}`);
  });
});
