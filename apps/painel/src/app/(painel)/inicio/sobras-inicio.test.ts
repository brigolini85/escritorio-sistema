import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

// JSX do painel compila no modo clássico no Vitest (tsconfig jsx: preserve), como nos outros testes de componente.
(globalThis as { React?: unknown }).React = React;

// Banco falso: cada teste diz o que cada tabela/função responde; o que não estiver no cenário falha.
const FALHA = { data: null, count: null, error: { code: '42883', message: 'não existe' } };
const cenario = { tabelas: {} as Record<string, unknown>, rpc: {} as Record<string, unknown>, chamadas: [] as [string, unknown][] };

function clienteFalso() {
  return {
    rpc: (nome: string, args?: unknown) => {
      cenario.chamadas.push([nome, args]);
      return Promise.resolve(nome in cenario.rpc ? cenario.rpc[nome] : FALHA);
    },
    from: (tabela: string) => {
      const resposta = () => (tabela in cenario.tabelas ? cenario.tabelas[tabela] : FALHA);
      const cadeia: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'gte', 'lt', 'in', 'is', 'not', 'order', 'limit']) cadeia[m] = () => cadeia;
      cadeia.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve(resposta()).then(ok, erro);
      return cadeia;
    },
  };
}
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => clienteFalso() }));

// Os leitores usam cache() do React: fora de uma requisição cada chamada lê de novo, então o cenário de cada teste vale.
const { lerAvisos, lerLimitesEspera, lerNomesPessoas } = await import('./dados-inicio');
const { ListaVencidas } = await import('./lista-vencidas');
const { TabelaSetores } = await import('./tabela-setores');
const { lerNumerosAgente, lerSetoresSituacao } = await import('./dados-situacao');
const { lerEstadoSistemaMesa } = await import('./dados-mesa');

const logs = () => vi.mocked(console.error).mock.calls.map((c) => String(c[0]));

beforeEach(() => {
  Object.assign(cenario, { tabelas: {}, rpc: {}, chamadas: [] });
  vi.spyOn(console, 'error').mockReset().mockImplementation(() => {});
});

describe('leitores comuns do Início: falha vai para o log', () => {
  it('avisos, limites de espera e nomes da equipe registram o erro (e seguem com o padrão)', async () => {
    expect(await lerAvisos()).toBeNull();
    await lerLimitesEspera();
    expect((await lerNomesPessoas()).size).toBe(0);
    expect(logs()).toEqual(expect.arrayContaining([
      '[inicio] falha ao ler os avisos', '[inicio] falha ao ler os limites de espera', '[inicio] falha ao ler os nomes da equipe',
    ]));
  });
  it('sem erro, nada no log', async () => {
    cenario.tabelas = { alertas: { data: [], count: 0, error: null }, usuarios: { data: [{ id: 'u1', nome: 'Ana' }], error: null } };
    cenario.rpc = { limites_espera: { data: null, error: null } };
    await lerAvisos();
    await lerLimitesEspera();
    expect((await lerNomesPessoas()).get('u1')).toBe('Ana');
    expect(logs()).toEqual([]);
  });
});

describe('Vencidas sem a demandas_por_setor (D21)', () => {
  it('o total do cabeçalho é "—", não o tamanho da lista (que para em 5)', async () => {
    const d = (i: number) => ({ id: `d${i}`, numero: i, titulo: `Demanda ${i}`, empresa: null, setor: 'Fiscal', responsavel: null, prazo_em: '2026-10-01T15:00:00Z', prazo_pausado_desde: null });
    cenario.tabelas = { demandas_lista: { data: [1, 2, 3, 4, 5].map(d), error: null } };
    const html = renderToStaticMarkup(await ListaVencidas());
    expect(html).toContain('Demanda 5');
    expect(html).toMatch(/<span class="[^"]*tabular[^"]*">—<\/span>/);
    expect(html).not.toMatch(/<span class="[^"]*tabular[^"]*">5<\/span>/);
  });
});

describe('Demandas por setor sem nenhuma aberta', () => {
  it('mostra só "Nenhuma demanda aberta.", sem tabela vazia ao lado', async () => {
    cenario.rpc = { demandas_por_setor: { data: [
      { setor_id: 's1', setor: 'Fiscal', abertas: 0, no_prazo: 0, vencem_hoje: 0, vencidas: 0, sem_responsavel: 0, urgentes: 0 },
      { setor_id: null, setor: 'Triagem', abertas: 0, no_prazo: 0, vencem_hoje: 0, vencidas: 0, sem_responsavel: 0, urgentes: 0 },
    ], error: null } };
    const html = renderToStaticMarkup(await TabelaSetores());
    expect(html).toContain('Nenhuma demanda aberta.');
    expect(html).not.toContain('<table');
  });
  it('com abertas, a tabela aparece', async () => {
    cenario.rpc = { demandas_por_setor: { data: [
      { setor_id: 's1', setor: 'Fiscal', abertas: 2, no_prazo: 2, vencem_hoje: 0, vencidas: 0, sem_responsavel: 0, urgentes: 0 },
    ], error: null } };
    const html = renderToStaticMarkup(await TabelaSetores());
    expect(html).toContain('<table');
    expect(html).not.toContain('Nenhuma demanda aberta.');
  });
});

describe('Funções do Início ausentes no banco (PGRST202, homologação antes do "ok", D21)', () => {
  const SEM_FUNCAO = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
  it('demandas por setor e estado do sistema devolvem null sem poluir o log', async () => {
    cenario.rpc = { demandas_por_setor: SEM_FUNCAO, estado_sistema_resumo: SEM_FUNCAO };
    expect(await lerSetoresSituacao()).toBeNull();
    expect(await lerEstadoSistemaMesa()).toBeNull();
    expect(logs()).toEqual([]);
  });
  it('outros erros continuam no log', async () => {
    expect(await lerSetoresSituacao()).toBeNull();
    expect(await lerEstadoSistemaMesa()).toBeNull();
    expect(logs()).toEqual(['[inicio] falha ao ler as demandas por setor', '[inicio] falha ao ler estado_sistema_resumo']);
  });
});

describe('Um só instante para as contagens do Painel de situação', () => {
  it('demandas_por_setor e agente_numeros_hoje recebem p_agora (o "agora" da página)', async () => {
    const agora = new Date('2026-10-08T13:45:00.000Z');
    vi.useFakeTimers({ now: agora, toFake: ['Date'] });
    try {
      await lerSetoresSituacao();
      await lerNumerosAgente();
    } finally {
      vi.useRealTimers();
    }
    const args = Object.fromEntries(cenario.chamadas);
    expect(args.demandas_por_setor).toEqual({ p_agora: agora.toISOString() });
    expect(args.agente_numeros_hoje).toEqual({ p_agora: agora.toISOString() });
  });
});
