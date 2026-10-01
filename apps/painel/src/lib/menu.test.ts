import { describe, expect, it } from 'vitest';
import { itensDoMenu } from './menu';

describe('itensDoMenu', () => {
  it('atendente não vê Usuários nem Configurações; sem a marcação não vê Assistente nem Treinar o agente', () => {
    expect(itensDoMenu({ papel: 'atendente', permissoes: [] }).map((i) => i.rotulo)).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos']);
  });
  it('quem tem assistente pelo site vê Assistente', () => {
    expect(itensDoMenu({ papel: 'atendente', permissoes: ['assistente_site'] }).map((i) => i.rotulo))
      .toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Assistente']);
  });
  it('quem tem a marcação Treinar o agente vê o item depois do Assistente', () => {
    expect(itensDoMenu({ papel: 'atendente', permissoes: ['treinar_agente'] }).map((i) => i.rotulo))
      .toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Treinar o agente']);
    expect(itensDoMenu({ papel: 'atendente', permissoes: ['treinar_agente', 'assistente_site'] }).map((i) => i.href))
      .toEqual(['/inicio', '/atendimento', '/demandas', '/clientes', '/contatos', '/assistente', '/treinar-agente']);
  });
  it('administrador vê Treinar o agente, Usuários e Configurações; Assistente só com a marcação', () => {
    expect(itensDoMenu({ papel: 'admin', permissoes: [] }).map((i) => i.rotulo))
      .toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Treinar o agente', 'Usuários', 'Configurações']);
    expect(itensDoMenu({ papel: 'admin', permissoes: ['assistente_site'] }).map((i) => i.rotulo))
      .toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Assistente', 'Treinar o agente', 'Usuários', 'Configurações']);
  });
});
