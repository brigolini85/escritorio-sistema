import { describe, expect, it } from 'vitest';
import { COLUNAS_CAIXA, consultaCaixa, lerPaginasCaixa, MAX_PAGINAS_CAIXA, FILTROS_MAIS, FILTROS_RAPIDOS, filtroPadrao, lerFiltroCaixa, ordenarCaixa, passaNoFiltro, rotuloFiltroCaixa, type LinhaCaixa } from './caixa';

const u = { id: 'ana', setores: ['fiscal'] };
const linha = (p: Partial<LinhaCaixa>): LinhaCaixa => ({ id: 'c', atendente_id: null, setores_abertos: [], sem_responsavel: false, aguardando_cliente: false, ...p });

describe('passaNoFiltro', () => {
  it('minhas = conversas que eu assumi', () => {
    expect(passaNoFiltro(linha({ atendente_id: 'ana' }), 'minhas', u)).toBe(true);
    expect(passaNoFiltro(linha({ atendente_id: 'caio' }), 'minhas', u)).toBe(false);
  });
  it('setor = chamado aberto em um dos meus setores', () => {
    expect(passaNoFiltro(linha({ setores_abertos: ['fiscal'] }), 'setor', u)).toBe(true);
    expect(passaNoFiltro(linha({ setores_abertos: ['pessoal'] }), 'setor', u)).toBe(false);
  });
  it('sem responsável e com o cliente', () => {
    expect(passaNoFiltro(linha({ sem_responsavel: true }), 'sem_responsavel', u)).toBe(true);
    expect(passaNoFiltro(linha({ aguardando_cliente: true }), 'aguardando', u)).toBe(true);
  });
  it('todas mostra tudo o que o RLS já liberou', () => {
    expect(passaNoFiltro(linha({}), 'todas', u)).toBe(true);
  });
});

describe('filtroPadrao', () => {
  it('administrador e quem não tem setor começam em Todas', () => {
    expect(filtroPadrao({ papel: 'admin', setores: ['fiscal'] })).toBe('todas');
    expect(filtroPadrao({ papel: 'atendente', setores: [] })).toBe('todas');
  });
  it('atendente com setor começa em Do meu setor', () => {
    expect(filtroPadrao({ papel: 'atendente', setores: ['fiscal'] })).toBe('setor');
  });
});

describe('filtros rápidos (Com o agente, Concluídas)', () => {
  it('com o agente = estado agente e nada esperando a equipe', () => {
    expect(passaNoFiltro(linha({ estado: 'agente' }), 'agente', u)).toBe(true);
    expect(passaNoFiltro(linha({ estado: 'agente', sem_responsavel: true }), 'agente', u)).toBe(false);
    expect(passaNoFiltro(linha({ estado: 'humano' }), 'agente', u)).toBe(false);
  });
  it('concluídas = com o agente e nenhuma demanda aberta', () => {
    expect(passaNoFiltro(linha({ estado: 'agente', chamados_abertos: 0 }), 'concluidas', u)).toBe(true);
    expect(passaNoFiltro(linha({ estado: 'humano', chamados_abertos: 0 }), 'concluidas', u)).toBe(false);
    expect(passaNoFiltro(linha({ estado: 'agente', chamados_abertos: 2 }), 'concluidas', u)).toBe(false);
    expect(passaNoFiltro(linha({}), 'concluidas', u)).toBe(false);
  });
  it('rápidos e "Mais" juntos cobrem todos os filtros, sem repetir', () => {
    const valores = [...FILTROS_RAPIDOS, ...FILTROS_MAIS].map((f) => f.valor);
    expect(new Set(valores).size).toBe(valores.length);
    expect([...valores].sort()).toEqual(['agente', 'aguardando', 'concluidas', 'minhas', 'sem_responsavel', 'setor', 'todas']);
    expect(rotuloFiltroCaixa('sem_responsavel')).toBe('Aguardando humano');
    expect(rotuloFiltroCaixa('aguardando')).toBe('Com o cliente');
    expect(rotuloFiltroCaixa('setor')).toBe('Do meu setor');
  });
  it('filtro desconhecido na URL vira o padrão da pessoa', () => {
    const atendente = { papel: 'atendente' as const, setores: ['fiscal'] };
    expect(lerFiltroCaixa('minhas', atendente)).toBe('minhas');
    expect(lerFiltroCaixa('concluidas', atendente)).toBe('concluidas');
    expect(lerFiltroCaixa('xyz', atendente)).toBe('setor');
    expect(lerFiltroCaixa(undefined, { papel: 'admin', setores: [] })).toBe('todas');
    // "Todas as conversas" começa em Todas, mesmo com setor (o nível vai no tipo, Parte D).
    expect(lerFiltroCaixa(undefined, { ...atendente, niveis: { atendimento: 'todas' } })).toBe('todas');
  });
});

describe('ordenarCaixa', () => {
  it('aguardando humano no topo, mantendo a ordem de chegada em cada grupo', () => {
    const l = [{ id: 'a', sem_responsavel: false }, { id: 'b', sem_responsavel: true }, { id: 'c', sem_responsavel: null }, { id: 'd', sem_responsavel: true }];
    expect(ordenarCaixa(l).map((x) => x.id)).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('consultaCaixa', () => {
  it('só os parâmetros com valor', () => {
    expect(consultaCaixa({ filtro: 'minhas', q: ' Maria ' })).toBe('?filtro=minhas&q=Maria');
    expect(consultaCaixa({ filtro: null, q: '  ' })).toBe('');
    expect(consultaCaixa({ q: 'a&b' })).toBe('?q=a%26b');
  });
});

// Revisão geral (painel I5): a lista do Atendimento carrega de 200 em 200 ("Carregar mais"), sem select *.
describe('páginas da lista do Atendimento', () => {
  it('lerPaginasCaixa: 1 a 10, o resto vira 1', () => {
    expect(lerPaginasCaixa(undefined)).toBe(1);
    expect(lerPaginasCaixa('3')).toBe(3);
    expect(lerPaginasCaixa('0')).toBe(1);
    expect(lerPaginasCaixa('abc')).toBe(1);
    expect(lerPaginasCaixa('99')).toBe(MAX_PAGINAS_CAIXA);
  });
  it('consultaCaixa leva "mais" só a partir da segunda página', () => {
    expect(consultaCaixa({ filtro: 'todas', mais: 1 })).toBe('?filtro=todas');
    expect(consultaCaixa({ filtro: 'todas', q: 'ana', mais: 2 })).toBe('?filtro=todas&q=ana&mais=2');
  });
  it('as colunas pedidas à caixa_entrada são as que a lista usa (sem *)', () => {
    expect(COLUNAS_CAIXA).not.toContain('*');
    for (const c of ['id', 'nome_contato', 'ultima_em', 'espera_desde', 'setores_abertos', 'sem_responsavel', 'aguardando_cliente', 'esperando_voce', 'cliente_apos_concluir']) {
      expect(COLUNAS_CAIXA.split(', ')).toContain(c);
    }
  });
});
