// Revisão geral I8: a vez da tarefa reenviava a conversa inteira (com PDFs em Base64) a cada rodada sem cache: só o sistema
// tinha cache_control. Agora o pedido usa o cache automático no topo (como o giro do Radar): a conversa que cresce é lida do cache.
import { beforeEach, describe, expect, it } from 'vitest';
import { anexarArquivoTeste, configurarAgenteTeste, criarTarefaTeste, limparBanco } from '@escritorio/db/teste';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { processarTarefa } from '../../src/tarefa/processar';
import { db, repos, setorId } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';

let chamadoId: string;

beforeEach(async () => {
  await limparBanco();
  await configurarAgenteTeste('contabil', { estado: 'ligado' });
  await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
  const cl = (await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '21448390000107' }).select('id').single()).data!;
  chamadoId = (await db.from('chamados').insert({ cliente_id: cl.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento de outubro' })
    .select('id').single()).data!.id;
});

describe('cache da conversa da tarefa', () => {
  it('toda rodada pede o cache automático no topo (e o sistema segue com o seu)', async () => {
    const t = await criarTarefaTeste({ chamadoId, etapas: ['Ler', 'Aprovação'] });
    await anexarArquivoTeste(t.id, { nome: 'extrato.csv', conteudo: 'data;historico;valor\n01/10;Tarifa;-12,50' });
    const ia = new IaRoteirizada([usarFerramentas({ nome: 'ler_arquivo', entrada: { nome: 'extrato.csv' } }), fim(), fim()]);
    await processarTarefa({ repos, ia, midia: criarArmazenamento(db), fila: new FilaFalsa(), relogio: () => new Date() }, t.id, false);
    expect(ia.recebidos.length).toBeGreaterThanOrEqual(2);
    for (const p of ia.recebidos) {
      expect((p as { cache_control?: unknown }).cache_control).toEqual({ type: 'ephemeral' });
      expect((p.system as { cache_control?: unknown }[])[0]!.cache_control).toEqual({ type: 'ephemeral' });
    }
  });
});
