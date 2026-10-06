import { describe, expect, it } from 'vitest';
import { EXPORTAR_DO_DRIVE, LIMITES_TAREFA, MIME_ATALHO_DRIVE, MIME_PASTA_DRIVE, TEXTO_IGNORADO, comoLerDoDrive, ehPasta, linkDaPasta, mimeBateComExtensao, pastaDoLink, pdfValido, type ItemDrive } from '../src';

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz012345';
const item = (x: Partial<ItemDrive>): ItemDrive => ({ id: ID, nome: 'extrato.pdf', mime: 'application/pdf', tamanho: 1000, modificadoEm: '2026-10-01T10:00:00Z', pais: ['p'], ...x });

describe('pastaDoLink', () => {
  it('aceita os links que a pessoa copia do navegador e o código sozinho', () => {
    expect(pastaDoLink(`https://drive.google.com/drive/folders/${ID}`)).toBe(ID);
    expect(pastaDoLink(`https://drive.google.com/drive/u/0/folders/${ID}?usp=sharing`)).toBe(ID);
    expect(pastaDoLink(`  https://drive.google.com/open?id=${ID}  `)).toBe(ID);
    expect(pastaDoLink(ID)).toBe(ID);
    expect(linkDaPasta(ID)).toBe(`https://drive.google.com/drive/folders/${ID}`);
  });
  it('recusa o que não é pasta do Drive', () => {
    for (const t of ['', 'pasta do cliente', 'curto123', `http://drive.google.com/drive/folders/${ID}`, `https://example.com/drive/folders/${ID}`,
      `https://drive.google.com/file/d/${ID}/view`, `https://drive.google.com.evil.com/drive/folders/${ID}`, `${ID}/../x`]) {
      expect(pastaDoLink(t), t).toBeNull();
    }
  });
});

describe('comoLerDoDrive (D6)', () => {
  it('baixa os tipos da tarefa até 10 MB; o tipo vem da extensão', () => {
    expect(comoLerDoDrive(item({}))).toEqual({ acao: 'baixar', nome: 'extrato.pdf', mime: 'application/pdf' });
    expect(comoLerDoDrive(item({ nome: 'banco.OFX', mime: 'application/octet-stream' }))).toEqual({ acao: 'baixar', nome: 'banco.OFX', mime: 'text/plain' });
    expect(comoLerDoDrive(item({ tamanho: LIMITES_TAREFA.arquivoBytes + 1 }))).toEqual({ acao: 'ignorar', motivo: 'grande' });
  });
  it('exporta Docs e Slides em PDF e Sheets em CSV, sem repetir a extensão', () => {
    expect(comoLerDoDrive(item({ nome: 'Contrato', mime: 'application/vnd.google-apps.document', tamanho: null })))
      .toEqual({ acao: 'exportar', nome: 'Contrato.pdf', mime: 'application/pdf' });
    expect(comoLerDoDrive(item({ nome: 'Folha.csv', mime: 'application/vnd.google-apps.spreadsheet', tamanho: null })))
      .toEqual({ acao: 'exportar', nome: 'Folha.csv', mime: 'text/csv' });
    expect(EXPORTAR_DO_DRIVE['application/vnd.google-apps.presentation']!.extensao).toBe('pdf');
  });
  it('ignora atalho, pasta, tipo que o agente não lê e nome vazio', () => {
    expect(comoLerDoDrive(item({ mime: MIME_ATALHO_DRIVE }))).toEqual({ acao: 'ignorar', motivo: 'atalho' });
    expect(comoLerDoDrive(item({ nome: 'notas.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))).toEqual({ acao: 'ignorar', motivo: 'tipo' });
    expect(comoLerDoDrive(item({ nome: 'Formulário', mime: 'application/vnd.google-apps.form' }))).toEqual({ acao: 'ignorar', motivo: 'tipo' });
    expect(comoLerDoDrive(item({ nome: '   ' }))).toEqual({ acao: 'ignorar', motivo: 'tipo' });
    expect(ehPasta({ mime: MIME_PASTA_DRIVE })).toBe(true);
    expect(() => comoLerDoDrive(item({ mime: MIME_PASTA_DRIVE }))).toThrow();
  });
  it('troca barras e caracteres de controle do nome e limita a 180', () => {
    const r = comoLerDoDrive(item({ nome: `a/b\\c\u0007${'x'.repeat(300)}.pdf` }));
    expect(r.acao).toBe('baixar');
    if (r.acao === 'baixar') {
      expect(r.nome).not.toMatch(/[/\\\u0000-\u001f]/);
      expect(r.nome.length).toBeLessThanOrEqual(180);
      expect(r.nome.endsWith('.pdf')).toBe(true);
    }
  });
});

describe('rulings F5, F7, F13', () => {
  it('F13: id de 19 a 200 e segmento mobile/', () => {
    const id19 = 'a'.repeat(19);
    expect(pastaDoLink(id19)).toBe(id19);
    expect(pastaDoLink('a'.repeat(18))).toBeNull();
    expect(pastaDoLink('a'.repeat(201))).toBeNull();
    expect(pastaDoLink(`https://drive.google.com/drive/mobile/folders/${ID}`)).toBe(ID);
  });
  it('F5: o mime tem de bater com a extensão; PDF começa com %PDF-', () => {
    expect(comoLerDoDrive(item({ nome: 'x.pdf', mime: 'text/html' }))).toEqual({ acao: 'ignorar', motivo: 'tipo' });
    expect(comoLerDoDrive(item({ nome: 'x.png', mime: 'application/octet-stream' }))).toEqual({ acao: 'ignorar', motivo: 'tipo' });
    expect(mimeBateComExtensao('application/pdf', 'a.PDF')).toBe(true);
    expect(pdfValido(new TextEncoder().encode('%PDF-1.7'))).toBe(true);
    expect(pdfValido(new TextEncoder().encode('<html>'))).toBe(false);
    expect(pdfValido(new Uint8Array())).toBe(false);
  });
  it('F7: motivo muitos tem texto', () => {
    expect(TEXTO_IGNORADO.muitos).toMatch(/300/);
  });
});
