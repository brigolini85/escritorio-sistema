import { describe, expect, it } from 'vitest';
import { MIME_ATALHO_DRIVE, MIME_PASTA_DRIVE } from '@escritorio/core';
import { ErroDrive } from '../../src/drive/leitor';
import { anunciarSituacaoDrive } from '../../src/drive/situacao';
import { criarDriveFalso } from '../../src/drive/falso';

describe('Drive falso', () => {
  const d = criarDriveFalso([
    { id: 'P', nome: 'Padaria', mime: MIME_PASTA_DRIVE, tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais: [] },
    { id: 'a', nome: 'a.csv', mime: 'text/csv', tamanho: 3, modificadoEm: '2026-10-01T00:00:00Z', pais: ['P'], conteudo: 'a;b' },
  ]);
  it('lista os filhos, baixa e anota o que baixou', async () => {
    expect((await d.listar('P')).map((i) => i.id)).toEqual(['a']);
    expect(new TextDecoder().decode(await d.baixar('a'))).toBe('a;b');
    expect(d.baixados).toEqual(['a']);
    await expect(d.listar('nao')).rejects.toMatchObject({ codigo: 'nao_encontrado' });
  });
});

describe('Drive falso: o que os testes das tarefas precisam', () => {
  const pasta = (id: string, pais: string[] = []) => ({ id, nome: id, mime: MIME_PASTA_DRIVE, tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais });
  const d = criarDriveFalso([
    pasta('P'), pasta('Q'), pasta('Compartilhada'),
    { id: 'at', nome: 'atalho', mime: MIME_ATALHO_DRIVE, tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais: ['P'] },
    { id: 'lixo', nome: 'lixo.pdf', mime: 'application/pdf', tamanho: 5, modificadoEm: '2026-10-01T00:00:00Z', pais: ['P'], conteudo: '%PDF-', lixeira: true },
    { id: 'dois', nome: 'dois.csv', mime: 'text/csv', tamanho: 1, modificadoEm: '2026-10-01T00:00:00Z', pais: ['P', 'Q'], conteudo: 'x' },
    { id: 'ud', nome: 'ud.csv', mime: 'text/csv', tamanho: 1, modificadoEm: '2026-10-01T00:00:00Z', pais: ['Compartilhada'], conteudo: 'y' },
    { id: 'doc', nome: 'Contrato', mime: 'application/vnd.google-apps.document', tamanho: null, modificadoEm: '2026-10-01T00:00:00Z', pais: ['P'], exportado: '%PDF-1.4' },
    { id: 'big', nome: 'big.pdf', mime: 'application/pdf', tamanho: 11 * 1024 * 1024, modificadoEm: '2026-10-01T00:00:00Z', pais: ['P'], conteudo: '%PDF-' },
  ]);
  it('atalho aparece como o Google lista; lixeira some; dois pais aparecem nas duas pastas', async () => {
    expect((await d.listar('P')).map((i) => i.id)).toEqual(['at', 'dois', 'doc', 'big']);
    expect((await d.listar('Q')).map((i) => i.id)).toEqual(['dois']);
    expect((await d.listar('Compartilhada')).map((i) => i.id)).toEqual(['ud']);
    expect(await d.item('lixo')).toBeNull();
    expect(await d.item('dois')).toEqual({ id: 'dois', nome: 'dois.csv', mime: 'text/csv', tamanho: 1, modificadoEm: '2026-10-01T00:00:00Z', pais: ['P', 'Q'] });
    expect(d.listados).toEqual(['P', 'Q', 'Compartilhada']);
  });
  it('exporta só o que é do Google; arquivo grande vira "grande"; não pasta não lista', async () => {
    expect(new TextDecoder().decode(await d.exportar('doc', 'application/pdf'))).toBe('%PDF-1.4');
    await expect(d.exportar('dois', 'text/csv')).rejects.toMatchObject({ codigo: 'falha' });
    await expect(d.baixar('big')).rejects.toMatchObject({ codigo: 'grande' });
    await expect(d.listar('dois')).rejects.toBeInstanceOf(ErroDrive);
  });
  it('sem acesso: a pasta não compartilhada lança sem_acesso', async () => {
    const s = criarDriveFalso([{ ...pasta('X'), semAcesso: true }]);
    await expect(s.listar('X')).rejects.toMatchObject({ codigo: 'sem_acesso' });
  });
});

describe('anunciarSituacaoDrive (D9)', () => {
  it('sem chave grava "não configurado"; chave boa grava o e-mail; falha do Google grava o erro curto; sem a I3b só avisa', async () => {
    const gravado: unknown[] = [];
    const repos = { registrarSituacaoDrive: async (s: unknown) => { gravado.push(s); return true; } };
    await anunciarSituacaoDrive(repos, { leitor: null, erro: null });
    await anunciarSituacaoDrive(repos, { leitor: criarDriveFalso([], 'x@y.iam.gserviceaccount.com'), erro: null });
    const quebrado = { ...criarDriveFalso([]), verificar: async () => { throw new Error('403'); } };
    await anunciarSituacaoDrive(repos, { leitor: quebrado, erro: null });
    await anunciarSituacaoDrive(repos, { leitor: null, erro: 'A chave da conta de serviço do Drive não é um JSON válido.' });
    expect(gravado).toEqual([
      { email: null, erro: null },
      { email: 'x@y.iam.gserviceaccount.com', erro: null },
      { email: 'drive-teste@escritorio.iam.gserviceaccount.com', erro: 'O Google recusou a conta do Drive do escritório. Confira a chave e se a API do Drive está ligada.' },
      { email: null, erro: 'A chave da conta de serviço do Drive não é um JSON válido.' },
    ]);
    await expect(anunciarSituacaoDrive({ registrarSituacaoDrive: async () => false }, { leitor: null, erro: null })).resolves.toBeUndefined();
    await expect(anunciarSituacaoDrive({ registrarSituacaoDrive: async () => { throw new Error('rede'); } }, { leitor: null, erro: null })).resolves.toBeUndefined();
  });
  it('o Drive que não respondeu ao ligar grava outro texto (não culpa a chave)', async () => {
    const gravado: unknown[] = [];
    const lento = { ...criarDriveFalso([]), verificar: async () => { throw new ErroDrive('falha', 'O Drive não respondeu a tempo.'); } };
    await anunciarSituacaoDrive({ registrarSituacaoDrive: async (s) => { gravado.push(s); return true; } }, { leitor: lento, erro: null });
    expect(gravado).toEqual([{ email: 'drive-teste@escritorio.iam.gserviceaccount.com', erro: 'O Drive não respondeu ao conferir a conta do escritório. Ele é conferido de novo na próxima leitura.' }]);
  });
});
