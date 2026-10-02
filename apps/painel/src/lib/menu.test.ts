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
  it('administrador vê Treinar o agente e Configurações; Usuários e permissões fica dentro de Configurações', () => {
    const itens = itensDoMenu({ papel: 'admin', permissoes: [] });
    expect(itens.map((i) => i.rotulo)).toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Treinar o agente', 'Configurações']);
    expect(itens.at(-1)!.filhos!.map((f) => [f.rotulo, f.href])).toEqual([
      ['Usuários e permissões', '/usuarios'],
      ['Setores', '/configuracoes#setores'],
      ['Expediente e IA', '/configuracoes#expediente'],
      ['Mensagens', '/configuracoes#mensagens'],
      ['Respostas prontas', '/configuracoes#respostas'],
      ['Feriados', '/configuracoes#feriados'],
    ]);
    expect(itensDoMenu({ papel: 'admin', permissoes: ['assistente_site'] }).map((i) => i.rotulo))
      .toEqual(['Início', 'Atendimento', 'Demandas', 'Clientes', 'Contatos', 'Assistente', 'Treinar o agente', 'Configurações']);
  });
});
