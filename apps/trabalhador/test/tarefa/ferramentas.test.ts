import { beforeEach, describe, expect, it } from 'vitest';
import { FERRAMENTAS_DO_CATALOGO } from '@escritorio/core';
import type { PerfilAgente } from '@escritorio/db';
import { anexarArquivoTeste, criarTarefaTeste, limparBanco } from '@escritorio/db/teste';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { AVISOS_TAREFA, conferirValoresCitados, executarFerramentaTarefa, ferramentasDaTarefa, type VezDaTarefa } from '../../src/tarefa/ferramentas';
import { db, repos, setorId } from '../apoio/cenario';

const perfil: PerfilAgente = { id: null, slug: 'contabil', nome: 'Agente Contábil', modelo: null, ferramentas: [], skills: [], skillEmTeste: null };
const d = { repos, midia: criarArmazenamento(db) };
let tarefaId: string;
async function vez(): Promise<VezDaTarefa> {
  return { tarefa: (await repos.tarefaParaTrabalho(tarefaId))!, perfil, entregou: false, abriuPendencia: false, lidosNaVez: 0 };
}
const usar = async (v: VezDaTarefa, nome: string, entrada: object) => {
  const r = await executarFerramentaTarefa(d, v, nome, entrada);
  return { r, dados: typeof r.conteudo === 'string' ? JSON.parse(r.conteudo) : r.conteudo };
};
const linha = (fonte: string, provisoria = false) => ({ descricao: 'Tarifa', valor: 12.5, texto: null, fonte, provisoria });

beforeEach(async () => {
  await limparBanco();
  const cl = (await db.from('clientes').insert({ razao_social: 'Padaria Sol', cnpj: '21448390000107' }).select('id').single()).data!;
  const ch = (await db.from('chamados').insert({ cliente_id: cl.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
  tarefaId = (await criarTarefaTeste({ chamadoId: ch.id, etapas: ['Ler', 'Lançar', 'Aprovação'] })).id;
  await anexarArquivoTeste(tarefaId, { nome: 'extrato.csv', conteudo: 'data;historico;valor\n01/10;Tarifa;-12,50' });
});

describe('ferramentas da tarefa (D9, D19)', () => {
  it('só as da tarefa (e as de skill): nada do catálogo, nada que envia', () => {
    const nomes = ferramentasDaTarefa(perfil).map((t) => t.name);
    expect(nomes).toEqual(['listar_arquivos', 'ler_arquivo', 'dados_da_empresa', 'concluir_etapa', 'anotar', 'abrir_pendencia', 'entregar_resultado']);
    expect(nomes.some((n) => (FERRAMENTAS_DO_CATALOGO as string[]).includes(n))).toBe(false);
  });
  it('ler_arquivo marca como lido; entregar_resultado aceita a fonte lida', async () => {
    const v = await vez();
    expect((await usar(v, 'ler_arquivo', { nome: 'EXTRATO.csv' })).dados).toMatchObject({ arquivo: 'extrato.csv', parte: 1 });
    expect(v.lidosNaVez).toBe(1);
    const { r } = await usar(v, 'entregar_resultado', { resumo: 'Prévia.', destaques: [], linhas: [linha('extrato.csv')], observacoes: null });
    expect(r.erro).toBe(false);
    expect(v.entregou).toBe(true);
    expect((await repos.tarefaParaTrabalho(tarefaId))!.resultado!.linhas).toHaveLength(1);
  });
  it('nunca inventa valores: fonte inventada ou arquivo não lido é recusado e nada é guardado', async () => {
    const v = await vez();
    const { r, dados } = await usar(v, 'entregar_resultado', { resumo: 'Prévia.', destaques: [],
      linhas: [linha('extrato.csv'), linha('extrato bb.pdf')], observacoes: null });
    expect(r.erro).toBe(true);
    expect(dados.erro).toContain(AVISOS_TAREFA.semFonte);
    expect(dados.erro).toContain('Linha 1 (Tarifa): "extrato.csv" não é um arquivo lido nesta tarefa.');
    expect((await repos.tarefaParaTrabalho(tarefaId))!.resultado).toBeNull();
    expect(v.entregou).toBe(false);
  });
  it('pendência do cliente exige a mensagem; a do analista leva as respostas rápidas; linha provisória cita a aberta', async () => {
    const v = await vez();
    expect((await usar(v, 'abrir_pendencia', { tipo: 'cliente', pergunta: 'Extrato do BB', detalhe: null, opcoes: [], mensagem_ao_cliente: null })).r.erro).toBe(true);
    const a = await usar(v, 'abrir_pendencia', { tipo: 'analista', pergunta: 'PIX é pró-labore?', detalhe: 'Itaú, pág. 3',
      opcoes: ['Pró-labore', 'Distribuição de lucro'], mensagem_ao_cliente: null });
    expect(a.dados.pendencia).toBe(1);
    expect(v.abriuPendencia).toBe(true);
    await usar(v, 'ler_arquivo', { nome: 'extrato.csv' });
    const ok = await usar(v, 'entregar_resultado', { resumo: 'Prévia.', destaques: [], linhas: [linha('pendência 1', true)], observacoes: null });
    expect(ok.r.erro).toBe(false);
  });
  it('concluir_etapa e anotar gravam; a Aprovação não é do agente', async () => {
    const v = await vez();
    expect((await usar(v, 'concluir_etapa', { etapa: 1, resumo: 'leu 1 arquivo' })).r.erro).toBe(false);
    expect((await usar(v, 'concluir_etapa', { etapa: 3, resumo: 'x' })).dados.erro).toBe('Etapa inválida: a última (Aprovação) é da pessoa.');
    await usar(v, 'anotar', { texto: 'Falta conciliar.' });
    const t = (await repos.tarefaParaTrabalho(tarefaId))!;
    expect(t.etapas[0]).toEqual({ nome: 'Ler', concluida: true, resumo: 'leu 1 arquivo' });
    expect(t.anotacoes).toBe('Falta conciliar.');
  });
  it('dados da empresa sem honorários nem acessos; ferramenta de fora é recusada', async () => {
    const v = await vez();
    const e = await usar(v, 'dados_da_empresa', {});
    expect(Object.keys(e.dados).sort()).toEqual(['cnpj', 'endereco', 'inscricao_estadual', 'nome_fantasia', 'razao_social', 'regime', 'uf']);
    expect((await usar(v, 'responder', { texto: 'oi' })).dados.erro).toBe('Ferramenta não liberada para tarefas: responder.');
  });
});

describe('resumo e destaques só citam valores das linhas (F9)', () => {
  const l = (descricao: string, valor: number, fonte: string) => ({ descricao, valor, texto: null, fonte, provisoria: false });
  const linhas = [l('Tarifa', -12.5, 'extrato.csv'), l('Pix recebido', 300, 'extrato.csv'), l('Venda', 1234.56, 'notas.xml')];
  const r = (resumo: string, destaques: { rotulo: string; valor: string; detalhe: string | null }[] = []) =>
    ({ versao: 1 as const, resumo, destaques, linhas, observacoes: null });
  it('valor de uma linha, total das linhas, total de um arquivo e entradas/saídas passam', () => {
    expect(conferirValoresCitados(r('Tarifa de R$ 12,50; vendas de 1.234,56; total R$ 1.522,06.', [
      { rotulo: 'Extrato', valor: 'R$ 287,50', detalhe: 'entradas R$ 300,00 e saídas R$ 12,50' },
      { rotulo: 'Vendas', valor: 'R$ 1.234,56', detalhe: null },
    ]))).toEqual([]);
  });
  it('datas, contagens, porcentagens e números sem centavos nem R$ não são conferidos', () => {
    expect(conferirValoresCitados(r('Outubro/2026: 214 lançamentos em 01/10/2026; 3,5% de tarifa; CNPJ 21448390000107.'))).toEqual([]);
  });
  it('valor que não está nas linhas é recusado, com onde estava', () => {
    expect(conferirValoresCitados(r('Saldo final de R$ 9.999,00.', [{ rotulo: 'Impostos', valor: 'R$ 50', detalhe: null }]))).toEqual([
      'Resumo: R$ 9.999,00 não está em nenhuma linha.',
      'Destaque 1 (Impostos): R$ 50 não está em nenhuma linha.',
    ]);
  });
  it('dinheiro fora do formato brasileiro é recusado, mesmo com o valor de uma linha; no formato certo passa', () => {
    const formato = (v: string) => `Resumo: ${v} — escreva no formato R$ 1.234,56, só com valores das linhas.`;
    expect(conferirValoresCitados(r('Tarifa de R$ 12.50 e vendas de R$ 1,234.56; R$ 1.234,567 no total; 1,234.56 reais.'))).toEqual([
      formato('R$ 12.50'), formato('R$ 1,234.56'), formato('R$ 1.234,567'), formato('1,234.56'),
    ]);
    expect(conferirValoresCitados(r('Saldo de R$ doze mil.'))).toEqual(['Resumo: "R$ doze mil." — escreva no formato R$ 1.234,56, só com valores das linhas.']);
    expect(conferirValoresCitados(r('Tarifa de R$12,50, 12,50 reais e R$ -12,50; vendas de 1.234,56 reais.'))).toEqual([]);
  });
  it('entregar_resultado recusa destaque com valor fora das linhas e nada é guardado', async () => {
    const v = await vez();
    await usar(v, 'ler_arquivo', { nome: 'extrato.csv' });
    const { r: res, dados } = await usar(v, 'entregar_resultado', { resumo: 'Prévia.', destaques: [{ rotulo: 'Saldo', valor: 'R$ 48.210,33', detalhe: null }],
      linhas: [linha('extrato.csv')], observacoes: null });
    expect(res.erro).toBe(true);
    expect(dados.erro).toContain(AVISOS_TAREFA.valorSemLinha);
    expect(dados.erro).toContain('Destaque 1 (Saldo): R$ 48.210,33 não está em nenhuma linha.');
    expect((await repos.tarefaParaTrabalho(tarefaId))!.resultado).toBeNull();
    expect(v.entregou).toBe(false);
  });
});
