import { describe, expect, it } from 'vitest';
import { itensDoMenu } from './menu';

describe('itensDoMenu', () => {
  it('atendente não vê Usuários nem Configurações; sem a marcação não vê Assistente', () => {
    expect(itensDoMenu({ papel: 'atendente', permissoes: [] }).map((i) => i.rotulo)).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos']);
  });
  it('quem tem assistente pelo site vê Assistente', () => {
    expect(itensDoMenu({ papel: 'atendente', permissoes: ['assistente_site'] }).map((i) => i.rotulo))
      .toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Assistente']);
  });
  it('administrador vê Usuários e Configurações; Assistente só com a marcação', () => {
    expect(itensDoMenu({ papel: 'admin', permissoes: [] }).map((i) => i.rotulo))
      .toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Usuários', 'Configurações']);
    expect(itensDoMenu({ papel: 'admin', permissoes: ['assistente_site'] }).map((i) => i.rotulo))
      .toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Assistente', 'Usuários', 'Configurações']);
  });
});
