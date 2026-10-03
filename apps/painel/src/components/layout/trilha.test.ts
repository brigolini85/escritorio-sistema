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
});
