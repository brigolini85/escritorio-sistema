import { describe, expect, it } from 'vitest';
import { BLOCOS, estadoArquivos, estadoDosBlocos, valoresDoCliente } from './ficha';

describe('Arquivos no índice da ficha (I4, sobra da I3b)', () => {
  it('Arquivos é o último bloco do índice', () => {
    expect(BLOCOS.at(-1)).toEqual({ id: 'arquivos', rotulo: 'Arquivos' });
  });
  it('pasta preenchida = completo; sem pasta = neutro', () => {
    expect(estadoArquivos('1PastaDaPadariaSolAbcdefghij')).toEqual({ tipo: 'completo' });
    expect(estadoArquivos(null)).toEqual({ tipo: 'neutro' });
    expect(estadoDosBlocos(valoresDoCliente(null, [], 0), new Date()).arquivos).toEqual({ tipo: 'neutro' });
  });
});
