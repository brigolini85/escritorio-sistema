import type Anthropic from '@anthropic-ai/sdk';
import { beforeEach, describe, expect, it } from 'vitest';
import { MIME_PASTA_DRIVE } from '@escritorio/core';
import { configurarAgenteTeste, criarTarefaTeste, definirPastaDriveTeste, limparBanco, sqlTeste } from '@escritorio/db/teste';
import { criarDriveFalso, type ArquivoFalso } from '../../src/drive/falso';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { guardarNaTarefa, removerDaTarefa } from '../../src/tarefa/armazenamento';
import { processarTarefa } from '../../src/tarefa/processar';
import { db, repos, setorId } from '../apoio/cenario';
import { FilaFalsa } from '../apoio/fila-falsa';
import { IaRoteirizada, fim, usarFerramentas } from '../apoio/ia-roteirizada';

// Parte I3b (D7, F4): a primeira vez da tarefa lê a pasta do cliente sozinha; o Drive que falha não derruba a vez.
const SOL = '1PastaDaPadariaSolAbcdefghij';
const ARVORE: ArquivoFalso[] = [
  { id: SOL, nome: 'Padaria Sol', mime: MIME_PASTA_DRIVE, tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais: [] },
  { id: '1ExtratoItauOutubroAbcdefgh', nome: 'extrato-itau.csv', mime: 'text/csv', tamanho: 40, modificadoEm: '2026-10-05T00:00:00Z', pais: [SOL],
    conteudo: 'data;historico;valor\n01/10;Tarifa;-12,50' },
];
let chamadoId: string;
let clienteId: string;
const deps = (ia: IaRoteirizada, drive = criarDriveFalso(ARVORE)) => ({
  repos, ia, midia: criarArmazenamento(db), fila: new FilaFalsa(), relogio: () => new Date(), drive, guardar: guardarNaTarefa(db), remover: removerDaTarefa(db),
});
const eventos = async (id: string) =>
  (await sqlTeste<{ texto: string }>('select texto from public.agente_tarefa_eventos where tarefa_id = $1 order by criado_em', [id])).map((e) => e.texto);

beforeEach(async () => {
  await limparBanco();
  await configurarAgenteTeste('contabil', { estado: 'ligado' });
  await db.from('configuracoes').update({ teto_ia_usd: 1000 }).eq('id', 1);
  clienteId = (await db.from('clientes').insert({ razao_social: 'Padaria Sol ME', cnpj: '21448390000107' }).select('id').single()).data!.id;
  chamadoId = (await db.from('chamados').insert({ cliente_id: clienteId, setor_id: await setorId('Contábil'), titulo: 'Fechamento de outubro' })
    .select('id').single()).data!.id;
  await definirPastaDriveTeste(clienteId, SOL);
});

describe('a pasta do cliente na vez da tarefa', () => {
  it('primeira vez: copia a pasta, oferece ler_pasta_do_cliente e o agente lê o arquivo do Drive', async () => {
    const t = await criarTarefaTeste({ chamadoId });
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'ler_arquivo', entrada: { nome: 'extrato-itau.csv' } }),
      usarFerramentas({ nome: 'entregar_resultado', entrada: { resumo: 'Prévia.', destaques: [],
        linhas: [{ descricao: 'Tarifa bancária', valor: 12.5, texto: null, fonte: 'extrato-itau.csv', provisoria: false }], observacoes: null } }),
      fim(),
    ]);
    await processarTarefa(deps(ia), t.id, false);
    expect(ia.recebidos[0]!.tools!.map((f) => (f as Anthropic.Tool).name)).toContain('ler_pasta_do_cliente');
    const situacao = JSON.stringify(ia.recebidos[0]!.messages[0]);
    expect(situacao).toContain('Pasta do cliente no Google Drive: ligada, só leitura.');
    expect(situacao).toContain('extrato-itau.csv');
    expect((await repos.tarefaParaTrabalho(t.id))!.estado).toBe('pronta');
    expect(await sqlTeste('select origem, caminho like $2 as na_tarefa from public.agente_tarefa_arquivos where tarefa_id = $1', [t.id, `${t.id}/drive/%`]))
      .toEqual([{ origem: 'drive', na_tarefa: true }]);
    expect(await eventos(t.id)).toContain('leu a pasta do Drive: 1 arquivo novo');
  });

  it('F4: o Drive que lança na primeira vez não derruba a vez; a linha do tempo diz por quê', async () => {
    const drive = criarDriveFalso(ARVORE);
    const quebrado = { ...drive, listar: async () => { throw new Error('socket hang up'); } };
    const t = await criarTarefaTeste({ chamadoId });
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'abrir_pendencia', entrada: { tipo: 'analista', pergunta: 'Cadê o extrato de outubro?', detalhe: null, opcoes: [], mensagem_ao_cliente: null } }),
      fim(),
    ]);
    await processarTarefa(deps(ia, quebrado), t.id, false);
    expect((await repos.tarefaParaTrabalho(t.id))!.estado).toBe('aguardando_pendencias');
    expect((await eventos(t.id)).some((e) => e.startsWith('não leu a pasta do Drive:'))).toBe(true);
  });

  it('sem Drive configurado: nada muda (sem a ferramenta, sem a linha da pasta)', async () => {
    const t = await criarTarefaTeste({ chamadoId });
    const ia = new IaRoteirizada([
      usarFerramentas({ nome: 'abrir_pendencia', entrada: { tipo: 'analista', pergunta: 'Cadê o extrato de outubro?', detalhe: null, opcoes: [], mensagem_ao_cliente: null } }),
      fim(),
    ]);
    await processarTarefa({ ...deps(ia), drive: null }, t.id, false);
    expect(ia.recebidos[0]!.tools!.map((f) => (f as Anthropic.Tool).name)).not.toContain('ler_pasta_do_cliente');
    expect(JSON.stringify(ia.recebidos[0]!.messages[0])).not.toContain('Pasta do cliente no Google Drive');
  });
});
