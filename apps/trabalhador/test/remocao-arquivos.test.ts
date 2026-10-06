import { describe, expect, it } from 'vitest';
import { removerArquivosDoJob } from '../src/midia/remocao';

describe('removerArquivosDoJob (revisão geral I5)', () => {
  it('apaga cada caminho no seu compartimento: "conversas/..." em anexos, "<tarefa>/<arquivo>" em tarefas', async () => {
    const anexos: string[][] = [];
    const tarefas: string[][] = [];
    await removerArquivosDoJob(
      ['conversas/95300000-0000-0000-0000-000000000001/rg.pdf', '95600000-0000-0000-0000-00000000000c/1-comprovante.pdf',
        'conversas/95300000-0000-0000-0000-000000000001/cpf.pdf'],
      { anexos: async (p) => { anexos.push(p); }, tarefas: async (p) => { tarefas.push(p); } });
    expect(anexos).toEqual([['conversas/95300000-0000-0000-0000-000000000001/rg.pdf', 'conversas/95300000-0000-0000-0000-000000000001/cpf.pdf']]);
    expect(tarefas).toEqual([['95600000-0000-0000-0000-00000000000c/1-comprovante.pdf']]);
  });

  it('só anexos (jobs antigos) continua indo para anexos, sem chamar tarefas', async () => {
    const chamadas: string[] = [];
    await removerArquivosDoJob(['conversas/a/b.pdf'], { anexos: async () => { chamadas.push('anexos'); }, tarefas: async () => { chamadas.push('tarefas'); } });
    expect(chamadas).toEqual(['anexos']);
  });
});
