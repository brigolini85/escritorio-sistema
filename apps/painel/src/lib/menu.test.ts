import { describe, expect, it } from 'vitest';
import { itensDoMenu } from './menu';

describe('itensDoMenu', () => {
  it('atendente não vê Configurações', () => {
    expect(itensDoMenu('atendente').map((i) => i.rotulo)).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos']);
  });
  it('administrador vê Configurações', () => {
    expect(itensDoMenu('admin').map((i) => i.rotulo)).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Configurações']);
  });
});
