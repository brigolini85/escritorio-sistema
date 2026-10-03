import { describe, expect, it } from 'vitest';
import { trilhaDaRota } from './trilha';

describe('trilha da barra do topo (ícone › Seção › Tela)', () => {
  it.each([
    ['/inicio', [{ rotulo: 'Início' }]],
    ['/atendimento/abc', [{ rotulo: 'Atendimento', href: '/atendimento' }, { rotulo: 'Conversa' }]],
    ['/atendimento', [{ rotulo: 'Atendimento' }]],
    ['/demandas', [{ rotulo: 'Gestão das demandas' }]],
    ['/clientes', [{ rotulo: 'Cadastros' }, { rotulo: 'Clientes' }]],
    ['/clientes/123', [{ rotulo: 'Cadastros' }, { rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Empresa' }]],
    ['/clientes/novo', [{ rotulo: 'Cadastros' }, { rotulo: 'Clientes', href: '/clientes' }, { rotulo: 'Novo cliente' }]],
    ['/contatos', [{ rotulo: 'Cadastros' }, { rotulo: 'Contatos' }]],
    ['/assistente', [{ rotulo: 'Assistente' }]],
    ['/treinar-agente', [{ rotulo: 'Treinar o agente' }]],
    ['/configuracoes', [{ rotulo: 'Configurações' }]],
    ['/gastos-ia', [{ rotulo: 'Administração' }, { rotulo: 'Gastos com IA' }]],
    ['/usuarios', [{ rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões' }]],
    ['/_design', [{ rotulo: 'Catálogo do design' }]],
  ])('%s', (rota, esperado) => {
    expect(trilhaDaRota(rota)).toEqual(esperado);
  });
  it('rota desconhecida devolve trilha vazia (só o ícone de Início)', () => {
    expect(trilhaDaRota('/qualquer')).toEqual([]);
  });
  it('prefixo parecido não casa (colisão de prefixos)', () => {
    expect(trilhaDaRota('/clientesX')).toEqual([]);
    expect(trilhaDaRota('/usuarios-x')).toEqual([]);
  });
  it('ficha da pessoa: Configurações › Usuários e permissões › Pessoa (o nome vem no título da página)', () => {
    expect(trilhaDaRota('/usuarios/novo')).toEqual([
      { rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões', href: '/usuarios' }, { rotulo: 'Nova pessoa' },
    ]);
    expect(trilhaDaRota('/usuarios/11111111-1111-4111-8111-111111111111')).toEqual([
      { rotulo: 'Configurações', href: '/configuracoes' }, { rotulo: 'Usuários e permissões', href: '/usuarios' }, { rotulo: 'Pessoa' },
    ]);
  });
});
