import { beforeEach, describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  erro: null as { code: string; message: string } | null, dados: true as unknown, chamadas: [] as [string, unknown][], revalidados: [] as string[],
  enfileiradas: [] as unknown[][], upErro: null as { message: string; statusCode?: string } | null,
}));
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: (p: string) => { falso.revalidados.push(p); } }));
vi.mock('@/lib/sessao', () => ({ obterUsuario: async () => ({ id: 'u1', papel: 'atendente', niveis: {}, setores: [] }) }));
vi.mock('@/lib/fila', () => ({
  enfileirarTarefa: async (...a: unknown[]) => { falso.enfileiradas.push(['tarefa', ...a]); },
  enfileirarPedidoPendencia: async (...a: unknown[]) => { falso.enfileiradas.push(['pedido', ...a]); },
}));
vi.mock('@/lib/supabase/servidor', () => ({
  supabaseServidor: async () => ({ storage: { from: () => ({ upload: async () => ({ error: falso.upErro }) }) }, rpc: async (nome: string, args: unknown) => { falso.chamadas.push([nome, args]); return { data: falso.dados, error: falso.erro }; } }),
}));
vi.mock('@/lib/supabase/servico', () => ({ supabaseServico: () => ({ storage: { from: () => ({ remove: async () => ({}) }) } }) }));
const acoes = await import('./tarefas-acoes');
const T = '11111111-1111-4111-8111-111111111111';
const P = '22222222-2222-4222-8222-222222222222';

beforeEach(() => { Object.assign(falso, { erro: null, dados: true, chamadas: [], revalidados: [], enfileiradas: [], upErro: null }); });

describe('ações da tarefa (D3, D7, D8, D11)', () => {
  it('criar enfileira a tarefa nova', async () => {
    falso.dados = T;
    expect(await acoes.criarTarefa(P, P, 'Fazer o fechamento', 'fechamento-mensal')).toEqual({ ok: true, id: T });
    expect(falso.chamadas[0]).toEqual(['criar_tarefa_agente', { p_chamado: P, p_agente: P, p_pedido: 'Fazer o fechamento', p_skill: 'fechamento-mensal' }]);
    expect(falso.enfileiradas).toEqual([['tarefa', T]]);
  });
  it('responder: só enfileira quando o banco diz que retomou', async () => {
    falso.dados = false;
    expect(await acoes.responderPendencia(T, P, 'Pró-labore')).toEqual({ ok: true });
    expect(falso.enfileiradas).toEqual([]);
    falso.dados = true;
    await acoes.responderPendencia(T, P, 'Pró-labore');
    expect(falso.enfileiradas).toEqual([['tarefa', T]]);
    expect(falso.revalidados).toContain(`/tarefas/${T}`);
  });
  it('pedir ao cliente enfileira o envio com a vez do pedido', async () => {
    falso.dados = 2;
    expect(await acoes.pedirAoCliente(T, P, P, 'Pode mandar o extrato?')).toEqual({ ok: true });
    expect(falso.enfileiradas).toEqual([['pedido', P, 2]]);
  });
  it('aprovar: recusa do banco vira a frase', async () => {
    falso.erro = { code: 'P0001', message: 'Responda as pendências antes de aprovar.' };
    expect(await acoes.aprovarTarefa(T)).toEqual({ ok: false, erro: 'Responda as pendências antes de aprovar.' });
  });
  it('id estranho não chega ao banco', async () => {
    expect(await acoes.pausarTarefa('x')).toEqual({ ok: false, erro: 'Tarefa não encontrada.' });
    expect(falso.chamadas).toEqual([]);
  });

  it('envio de arquivo: cada erro do Storage tem a sua frase e vai para o log', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const envio = () => { const d = new FormData(); d.set('arquivo', new File(['x'], 'extrato.pdf')); return acoes.enviarArquivoTarefa(T, d); };
    const casos: [{ message: string; statusCode?: string }, string][] = [
      [{ message: 'new row violates row-level security policy', statusCode: '403' }, 'Só quem é do setor da demanda envia arquivo para uma tarefa em andamento.'],
      [{ message: 'The resource already exists', statusCode: '409' }, 'Já existe um arquivo com esse nome nesta tarefa.'],
      [{ message: 'mime type application/x is not supported', statusCode: '415' }, 'Esse tipo de arquivo não é aceito.'],
      [{ message: 'fetch failed' }, 'Não foi possível salvar agora. Tente de novo.'],
    ];
    for (const [erro, frase] of casos) {
      falso.upErro = erro;
      expect(await envio()).toEqual({ ok: false, erro: frase });
    }
    expect(log).toHaveBeenCalledTimes(4);
    expect(falso.chamadas).toEqual([]);
    log.mockRestore();
  });
});
