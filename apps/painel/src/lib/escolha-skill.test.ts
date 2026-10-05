import { describe, expect, it } from 'vitest';
import { escolherArquivosSkill, passaDoEnvio } from './escolha-skill';

const PDF = 'PDF ainda não entra nas skills: mande o texto em .md, .txt ou .csv (PDF chega com as tarefas de trabalho).';
const a = (caminho: string, tamanho = 10) => ({ caminho, tamanho });

describe('escolha de arquivos da skill na tela (revisão final, Important 1)', () => {
  it('pasta: tira PDF e outros formatos, com a frase do servidor (a do PDF primeiro)', () => {
    const r = escolherArquivosSkill([a('cfop/SKILL.md'), a('cfop/x.xlsx'), a('cfop/guia.pdf', 9_000_000), a('cfop/tabela.csv')]);
    expect(r.escolhidos.map((e) => e.caminho)).toEqual(['cfop/SKILL.md', 'cfop/tabela.csv']);
    expect(r.aviso).toBe(PDF);
    expect(r.deFora).toEqual(['x.xlsx', 'guia.pdf']);
  });
  it('sem PDF: a frase do formato do primeiro tirado', () => {
    const r = escolherArquivosSkill([a('p/SKILL.md'), a('p/desktop.ini')]);
    expect(r.aviso).toBe('O arquivo "desktop.ini" não é .md, .txt nem .csv.');
    expect(r.escolhidos).toHaveLength(1);
  });
  it('um .zip ou um .md sozinho segue; um .pdf sozinho sai', () => {
    expect(escolherArquivosSkill([a('skill.zip')])).toEqual({ escolhidos: [a('skill.zip')], aviso: null, deFora: [] });
    expect(escolherArquivosSkill([a('limite.md')])).toEqual({ escolhidos: [a('limite.md')], aviso: null, deFora: [] });
    expect(escolherArquivosSkill([a('guia.pdf')])).toEqual({ escolhidos: [], aviso: PDF, deFora: ['guia.pdf'] });
  });
  it('acima de 10 MB somados não manda', () => {
    expect(passaDoEnvio([a('a.md', 6 * 1024 * 1024), a('b.md', 4 * 1024 * 1024)])).toBe(false);
    expect(passaDoEnvio([a('a.md', 6 * 1024 * 1024), a('b.md', 4 * 1024 * 1024 + 1)])).toBe(true);
  });
});
