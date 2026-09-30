import { describe, expect, it } from 'vitest';
import { enderecoSemErro } from './erro-na-url';

describe('enderecoSemErro', () => {
  it('tira só o erro e mantém os outros parâmetros', () => {
    expect(enderecoSemErro('/atendimento/1', 'filtro=minhas&erro=Falhou&q=abc')).toBe('/atendimento/1?filtro=minhas&q=abc');
  });
  it('sem outros parâmetros volta ao caminho puro', () => {
    expect(enderecoSemErro('/assistente', 'erro=Falhou%20aqui')).toBe('/assistente');
    expect(enderecoSemErro('/assistente', '')).toBe('/assistente');
  });
});
