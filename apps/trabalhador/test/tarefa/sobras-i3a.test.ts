import { describe, expect, it } from 'vitest';
import { configurarAgenteTeste, criarTarefaTeste, limparBanco } from '@escritorio/db/teste';
import { carregarPerfil } from '../../src/agente/perfil';
import { executarTarefa } from '../../src/tarefa/executar';
import { limparArquivosDasTarefas } from '../../src/tarefa/guarda';
import { db, repos, setorId } from '../apoio/cenario';

describe('corrida em CONTINUAR (D15a)', () => {
  it('a vez que vê a tarefa fora de "trabalhando" fecha com continuar, sem chamar a IA', async () => {
    await limparBanco();
    await configurarAgenteTeste('contabil', { estado: 'ligado' });
    const cl = (await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '21448390000107' } as never).select('id').single()).data!;
    const ch = (await db.from('chamados').insert({ cliente_id: cl.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
    const t = await criarTarefaTeste({ chamadoId: ch.id, estado: 'pausada', motivoPausa: 'pessoa' });
    const tarefa = (await repos.tarefaParaTrabalho(t.id))!;
    const perfil = await carregarPerfil(repos, 'contabil');
    const ia = { criar: async () => { throw new Error('a IA não pode ser chamada'); } };
    const motivo = await executarTarefa({ repos, ia, midia: {} as never, fila: { enviar: async () => {} }, relogio: () => new Date() },
      { tarefa, perfil, entregou: false, abriuPendencia: false, lidosNaVez: 0 }, await repos.obterConfiguracoes(), [], new Date());
    expect(motivo).toBe('continuar');
  });
});

describe('guarda dos arquivos das tarefas (D14)', () => {
  it('remove do Storage e marca, em lotes, até acabar', async () => {
    const lotes = [[{ id: 'a', caminho: 't1/1-a.pdf' }, { id: 'b', caminho: 't1/drive/x-1.pdf' }], []];
    const removidos: string[] = [];
    const marcados: string[] = [];
    const n = await limparArquivosDasTarefas({
      arquivosVencidosDasTarefas: async () => lotes.shift() ?? [],
      marcarArquivosRemovidos: async (ids: string[]) => { marcados.push(...ids); return ids.length; },
    }, async (c) => { removidos.push(...c); });
    expect(n).toBe(2);
    expect(removidos).toEqual(['t1/1-a.pdf', 't1/drive/x-1.pdf']);
    expect(marcados).toEqual(['a', 'b']);
  });
  it('banco sem a I3b: nada a fazer, sem erro', async () => {
    expect(await limparArquivosDasTarefas({ arquivosVencidosDasTarefas: async () => null, marcarArquivosRemovidos: async () => 0 }, async () => {})).toBe(0);
  });
  it('falha ao remover do Storage não marca (tenta de novo amanhã)', async () => {
    const marcados: string[] = [];
    await expect(limparArquivosDasTarefas({
      arquivosVencidosDasTarefas: async () => [{ id: 'a', caminho: 'x' }],
      marcarArquivosRemovidos: async (ids: string[]) => { marcados.push(...ids); return ids.length; },
    }, async () => { throw new Error('storage'); })).rejects.toThrow('storage');
    expect(marcados).toEqual([]);
  });
});
