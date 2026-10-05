import { beforeEach, describe, expect, it } from 'vitest';
import { anexarArquivoTeste, criarTarefaTeste, limparBanco } from '@escritorio/db/teste';
import { criarArmazenamento } from '../../src/midia/armazenamento';
import { AVISOS_ARQUIVO, decodificarTexto, lerArquivoDaTarefa, paginasDoPdf } from '../../src/tarefa/arquivos';
import { db, repos, setorId } from '../apoio/cenario';

// Um PDF mínimo de 2 páginas (só o necessário para contar "/Type /Page").
const PDF = new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Type /Pages /Count 2 >> endobj\n2 0 obj << /Type /Page >> endobj\n3 0 obj << /Type /Page >> endobj\n%%EOF');
const midia = criarArmazenamento(db);

async function tarefa(): Promise<string> {
  const cl = (await db.from('clientes').insert({ razao_social: 'Padaria Sol', cnpj: '21448390000107' }).select('id').single()).data!;
  const ch = (await db.from('chamados').insert({ cliente_id: cl.id, setor_id: await setorId('Contábil'), titulo: 'Fechamento' }).select('id').single()).data!;
  return (await criarTarefaTeste({ chamadoId: ch.id })).id;
}
async function arquivo(tarefaId: string, nome: string) {
  return (await repos.tarefaParaTrabalho(tarefaId))!.arquivos.find((a) => a.nome === nome)!;
}

beforeEach(limparBanco);

describe('leitura dos arquivos da tarefa (D15)', () => {
  it('PDF vai inteiro como documento, com o número de páginas', async () => {
    const id = await tarefa();
    await anexarArquivoTeste(id, { nome: 'extrato itau.pdf', conteudo: PDF, mime: 'application/pdf' });
    const r = await lerArquivoDaTarefa(midia, await arquivo(id, 'extrato itau.pdf'));
    expect(r.ok && r.detalhe).toBe('2 págs');
    expect(r.ok && Array.isArray(r.conteudo) && r.conteudo[1]).toMatchObject({ type: 'document', source: { type: 'base64', media_type: 'application/pdf' }, title: 'extrato itau.pdf' });
  });
  it('texto em partes de 40.000 caracteres; Windows-1252 também é lido', async () => {
    const id = await tarefa();
    await anexarArquivoTeste(id, { nome: 'extrato.csv', conteudo: `data;historico;valor\n${'01/10;Tarifa;-12,50\n'.repeat(3000)}` });
    const a = await arquivo(id, 'extrato.csv');
    const r1 = await lerArquivoDaTarefa(midia, a);
    const p1 = JSON.parse(r1.ok ? (r1.conteudo as string) : '{}');
    expect(p1).toMatchObject({ arquivo: 'extrato.csv', parte: 1, partes: 2 });
    expect(p1.texto).toHaveLength(40_000);
    expect(await lerArquivoDaTarefa(midia, a, 3)).toEqual({ ok: false, erro: AVISOS_ARQUIVO.parte });
    expect(decodificarTexto(new Uint8Array([0x4c, 0x61, 0x6e, 0xe7, 0x61]))).toBe('Lança');
    expect(decodificarTexto(new Uint8Array([0xef, 0xbb, 0xbf, 0x4f, 0x4b]))).toBe('OK'); // BOM do UTF-8 não vai para o texto
  });
  it('tipo que o agente não lê, binário disfarçado e PDF grande demais: instrução de abrir pendência', async () => {
    const id = await tarefa();
    await anexarArquivoTeste(id, { nome: 'planilha.xlsx', conteudo: 'x' });
    await anexarArquivoTeste(id, { nome: 'dados.txt', conteudo: new Uint8Array([65, 0, 66]) });
    await anexarArquivoTeste(id, { nome: 'grande.pdf', conteudo: new Uint8Array(4 * 1024 * 1024 + 1), mime: 'application/pdf' });
    expect(await lerArquivoDaTarefa(midia, await arquivo(id, 'planilha.xlsx'))).toEqual({ ok: false, erro: AVISOS_ARQUIVO.tipo('planilha.xlsx') });
    expect(await lerArquivoDaTarefa(midia, await arquivo(id, 'dados.txt'))).toEqual({ ok: false, erro: AVISOS_ARQUIVO.naoTexto('dados.txt') });
    expect(await lerArquivoDaTarefa(midia, await arquivo(id, 'grande.pdf'))).toEqual({ ok: false, erro: AVISOS_ARQUIVO.grande('grande.pdf') });
  });
  it('arquivo que sumiu do armazenamento', async () => {
    const id = await tarefa();
    await anexarArquivoTeste(id, { nome: 'a.csv', conteudo: 'x' });
    const a = { ...(await arquivo(id, 'a.csv')), caminho: `${id}/nao-existe.csv` };
    expect(await lerArquivoDaTarefa(midia, a)).toEqual({ ok: false, erro: AVISOS_ARQUIVO.semArquivo });
  });
  it('outro erro de leitura não vira "arquivo não encontrado" (F24)', async () => {
    const id = await tarefa();
    await anexarArquivoTeste(id, { nome: 'a.csv', conteudo: 'x' });
    const falha = { ler: async () => { throw new Error('leitura falhou: fetch failed'); } };
    await expect(lerArquivoDaTarefa(falha, await arquivo(id, 'a.csv'))).rejects.toThrow('fetch failed');
  });
  it('páginas do PDF', () => {
    expect(paginasDoPdf(PDF)).toBe(2);
    expect(paginasDoPdf(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});
