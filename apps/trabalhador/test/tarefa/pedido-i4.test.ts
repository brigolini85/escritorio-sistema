import type Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { MIME_PASTA_DRIVE } from '@escritorio/core';
import { configurarAgenteTeste, criarTarefaTeste, definirPastaDriveTeste, limparBanco, opcoesPedidoTeste, sqlTeste } from '@escritorio/db/teste';
import { criarDriveFalso, type ArquivoFalso } from '../../src/drive/falso';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { guardarNaTarefa, removerDaTarefa } from '../../src/tarefa/armazenamento';
import { linhaDoPedido, processarTarefa } from '../../src/tarefa/processar';
import { db, repos, setorId } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';

// Parte I4 (D7, D19b): o prazo desejado e a subpasta do pedido entram na vez; a leitura automática que falhou deixa rastro.
const SOL = '1PastaDaPadariaSolAbcdefghij';
const ARVORE: ArquivoFalso[] = [
  { id: SOL, nome: 'Padaria Sol', mime: MIME_PASTA_DRIVE, tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais: [] },
  { id: '1ExtratoItauOutubroAbcdefgh', nome: 'extrato-itau.csv', mime: 'text/csv', tamanho: 40, modificadoEm: '2026-10-05T00:00:00Z', pais: [SOL],
    conteudo: 'data;historico;valor\n01/10;Tarifa;-12,50' },
];
const ARVORE_COM_SUB: ArquivoFalso[] = [
  ...ARVORE,
  { id: '1SubpastaFiscalAbcdefghijk', nome: 'Fiscal', mime: MIME_PASTA_DRIVE, tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais: [SOL] },
  { id: '1NotaSetembroAbcdefghijklm', nome: 'nota.xml', mime: 'text/xml', tamanho: 20, modificadoEm: '2026-10-02T00:00:00Z', pais: ['1SubpastaFiscalAbcdefghijk'],
    conteudo: '<nfe/>' },
];
let chamadoId: string;
let clienteId: string;
const deps = (ia: IaRoteirizada, drive = criarDriveFalso(ARVORE)) => ({
  repos, ia, midia: criarArmazenamento(db), fila: new FilaFalsa(), relogio: () => new Date(), drive, guardar: guardarNaTarefa(db), remover: removerDaTarefa(db),
});
const eventos = async (id: string) =>
  (await sqlTeste<{ texto: string }>('select texto from public.agente_tarefa_eventos where tarefa_id = $1 order by criado_em', [id])).map((e) => e.texto);
const pendencia = (pergunta: string) =>
  usarFerramentas({ nome: 'abrir_pendencia', entrada: { tipo: 'analista', pergunta, detalhe: null, opcoes: [], mensagem_ao_cliente: null } });

beforeEach(async () => {
  await limparBanco();
  await configurarAgenteTeste('contabil', { estado: 'ligado' });
  await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
  clienteId = (await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '21448390000107' }).select('id').single()).data!.id;
  chamadoId = (await db.from('chamados').insert({ cliente_id: clienteId, setor_id: await setorId('Contábil'), titulo: 'Fechamento de outubro' })
    .select('id').single()).data!.id;
  await definirPastaDriveTeste(clienteId, SOL);
});

describe('opções do pedido na vez da tarefa (I4)', () => {
  it('linhaDoPedido: prazo em Brasília; sem prazo, nada', () => {
    expect(linhaDoPedido({ prazoDesejado: '2026-10-08T15:00:00.000Z', lerDrive: true, subpasta: null, avisarPainel: true, avisarWhatsapp: false }))
      .toBe('Prazo desejado por quem pediu: 08/10/2026 12:00 (Brasília). Se não der tempo, diga nas observações.');
    expect(linhaDoPedido({ prazoDesejado: null, lerDrive: true, subpasta: null, avisarPainel: true, avisarWhatsapp: false })).toBeNull();
  });

  it('o prazo vai num bloco a mais do sistema, depois dos de hoje', async () => {
    const t = await criarTarefaTeste({ chamadoId });
    await opcoesPedidoTeste(t.id, { prazo: '2026-12-01T15:00:00Z' });
    const ia = new IaRoteirizada([pendencia('Qual banco?'), fim()]);
    await processarTarefa(deps(ia), t.id, false);
    const sistema = ia.recebidos[0]!.system as { text: string }[];
    expect(sistema.at(-1)!.text).toContain('Prazo desejado por quem pediu: 01/12/2026 12:00 (Brasília).');
  });

  it('subpasta: a primeira vez lê só a subpasta', async () => {
    const t = await criarTarefaTeste({ chamadoId });
    await opcoesPedidoTeste(t.id, { subpasta: 'Fiscal' });
    const ia = new IaRoteirizada([pendencia('E o resto?'), fim()]);
    await processarTarefa(deps(ia, criarDriveFalso(ARVORE_COM_SUB)), t.id, false);
    expect((await sqlTeste<{ nome: string }>('select nome from public.agente_tarefa_arquivos where tarefa_id = $1', [t.id])).map((a) => a.nome)).toEqual(['nota.xml']);
  });

  it('ler_drive = false: a primeira vez não lê a pasta (a ferramenta continua lá)', async () => {
    const t = await criarTarefaTeste({ chamadoId });
    await opcoesPedidoTeste(t.id, { lerDrive: false });
    const ia = new IaRoteirizada([pendencia('Leio a pasta?'), fim()]);
    await processarTarefa(deps(ia), t.id, false);
    expect(await sqlTeste('select count(*)::int as n from public.agente_tarefa_arquivos where tarefa_id = $1', [t.id])).toEqual([{ n: 0 }]);
    expect(ia.recebidos[0]!.tools!.map((f) => (f as Anthropic.Tool).name)).toContain('ler_pasta_do_cliente');
  });

  it('D19b: erro ao saber a pasta na primeira vez deixa o motivo na linha do tempo', async () => {
    const t = await criarTarefaTeste({ chamadoId });
    const reposQuebrado = new Proxy(repos, { get: (alvo, k) =>
      k === 'pastaDriveDaTarefa' ? async () => { throw new Error('conexão caiu'); } : Reflect.get(alvo, k) });
    const ia = new IaRoteirizada([pendencia('Cadê?'), fim()]);
    await processarTarefa({ ...deps(ia), repos: reposQuebrado }, t.id, false);
    expect(await eventos(t.id)).toContain('não deu para ler a pasta do Drive agora: use Ler a pasta de novo');
  });

  it('banco sem a I4: opções null, a vez é a da I3b', async () => {
    const t = await criarTarefaTeste({ chamadoId });
    const semI4 = new Proxy(repos, { get: (alvo, k) => (k === 'opcoesDoPedido' ? async () => null : Reflect.get(alvo, k)) });
    const ia = new IaRoteirizada([pendencia('X?'), fim()]);
    await processarTarefa({ ...deps(ia), repos: semI4 }, t.id, false);
    expect((ia.recebidos[0]!.system as { text: string }[]).map((b) => b.text).join()).not.toContain('Prazo desejado');
    expect(await eventos(t.id)).toContain('leu a pasta do Drive: 1 arquivo novo');
  });
});
