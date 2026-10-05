import { strToU8, zipSync } from 'fflate';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { arquivosDoFormulario } = await import('./pacote-skill');

const SKILL = '---\nname: tabela-cfop\ndescription: CFOPs.\ntipo: conhecimento\n---\n# Tabela CFOP\nTexto.';
const form = (...arquivos: File[]) => { const f = new FormData(); for (const a of arquivos) f.append('arquivos', a, a.name); return f; };

describe('arquivos da subida (D7, D8)', () => {
  it('pasta: o caminho relativo vem no nome do arquivo', async () => {
    const r = await arquivosDoFormulario(form(new File([SKILL], 'tabela-cfop/SKILL.md'), new File(['5102;Venda'], 'tabela-cfop/cfop.csv')));
    expect(r).toEqual({ ok: true, arquivos: [{ caminho: 'tabela-cfop/SKILL.md', conteudo: SKILL }, { caminho: 'tabela-cfop/cfop.csv', conteudo: '5102;Venda' }] });
  });
  it('pasta: o campo paralelo `caminhos` vale mais que o nome (o Next tira a pasta do nome), pareado por índice (F7)', async () => {
    const f = form(new File([SKILL], 'SKILL.md'), new File(['5102;Venda'], 'cfop.csv'), new File(['x'], 'solto.txt'));
    f.append('caminhos', 'tabela-cfop/SKILL.md');
    f.append('caminhos', 'tabela-cfop/refs/cfop.csv');   // o terceiro não tem caminho: cai no nome
    const r = await arquivosDoFormulario(f);
    expect(r).toEqual({ ok: true, arquivos: [
      { caminho: 'tabela-cfop/SKILL.md', conteudo: SKILL }, { caminho: 'tabela-cfop/refs/cfop.csv', conteudo: '5102;Venda' }, { caminho: 'solto.txt', conteudo: 'x' },
    ] });
  });
  it('pareamento por índice não se perde quando um arquivo vazio é descartado', async () => {
    const f = form(new File([], 'vazio.txt'), new File([SKILL], 'SKILL.md'));
    f.append('caminhos', 'pasta/vazio.txt');
    f.append('caminhos', 'pasta/SKILL.md');
    expect(await arquivosDoFormulario(f)).toEqual({ ok: true, arquivos: [{ caminho: 'pasta/SKILL.md', conteudo: SKILL }] });
  });
  it('.zip: abre por dentro, sem as pastas', async () => {
    const zip = zipSync({ 'tabela-cfop/': new Uint8Array(), 'tabela-cfop/SKILL.md': strToU8(SKILL), 'tabela-cfop/refs/cfop.csv': strToU8('a;b') });
    const r = await arquivosDoFormulario(form(new File([zip], 'tabela-cfop.zip')));
    expect(r).toEqual({ ok: true, arquivos: [{ caminho: 'tabela-cfop/SKILL.md', conteudo: SKILL }, { caminho: 'tabela-cfop/refs/cfop.csv', conteudo: 'a;b' }] });
  });
  it('.zip que explode ao abrir (tamanho aberto) ou com arquivos demais é recusado antes de descompactar', async () => {
    const grande = zipSync({ 'a/SKILL.md': strToU8(SKILL), 'a/b.txt': new Uint8Array(3 * 1024 * 1024 + 1) });
    expect(grande.length).toBeLessThan(100_000);   // comprime muito: só passa pelo teto do tamanho aberto
    expect(await arquivosDoFormulario(form(new File([grande], 'a.zip')))).toEqual({ ok: false, erro: 'O .zip aberto passa de 3 MB.' });
    const muitos: Record<string, Uint8Array> = {};
    for (let i = 0; i < 61; i++) muitos[`a/r${i}.txt`] = strToU8('x');
    expect(await arquivosDoFormulario(form(new File([zipSync(muitos)], 'a.zip')))).toEqual({ ok: false, erro: 'O .zip tem arquivos demais (até 60).' });
  });
  it('.zip corrompido: frase, sem estourar', async () => {
    expect(await arquivosDoFormulario(form(new File([new Uint8Array([1, 2, 3, 4])], 'a.zip'))))
      .toEqual({ ok: false, erro: 'Não consegui abrir o .zip. Confira se o arquivo está inteiro e sem senha.' });
  });
  it('envio acima de 10 MB é recusado', async () => {
    expect(await arquivosDoFormulario(form(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'SKILL.md')))).toEqual({ ok: false, erro: 'Os arquivos passam de 10 MB.' });
  });
  it('PDF e outros formatos seguem sem conteúdo (o core recusa com a frase certa); .md fora do UTF-8 é recusado aqui', async () => {
    const r = await arquivosDoFormulario(form(new File([SKILL], 'SKILL.md'), new File(['%PDF'], 'guia.pdf')));
    expect(r).toEqual({ ok: true, arquivos: [{ caminho: 'SKILL.md', conteudo: SKILL }, { caminho: 'guia.pdf', conteudo: '' }] });
    expect(await arquivosDoFormulario(form(new File([new Uint8Array([0xff, 0xfe, 0x00])], 'SKILL.md'))))
      .toEqual({ ok: false, erro: 'O arquivo "SKILL.md" não é texto em UTF-8.' });
  });
  it('nada escolhido', async () => {
    expect(await arquivosDoFormulario(new FormData())).toEqual({ ok: false, erro: 'Escolha uma pasta, um .zip ou um .md.' });
  });
});
