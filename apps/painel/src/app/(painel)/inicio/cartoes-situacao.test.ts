import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsuarioPainel } from '@/lib/sessao';

vi.mock('server-only', () => ({}));
vi.mock('./acoes', () => ({ alternarPausaGeral: vi.fn() }));

// JSX do painel compila no modo clássico no Vitest (tsconfig jsx: preserve), como nos outros testes de componente.
(globalThis as { React?: unknown }).React = React;
const { CartaoAgente } = await import('./cartao-agente');
const { CartaoGasto } = await import('./cartao-gasto');
const { NumerosSituacao } = await import('./numeros-situacao');

// Banco falso como a homologação antes das migrações F e G2: sem a coluna cotacao_usd_brl e sem as funções novas.
const FALHA = { data: null, count: null, error: { code: '42703', message: 'não existe' } };
const cenario = { pausado: false, cotacao: false, rpc: {} as Record<string, unknown> };

function clienteFalso() {
  return {
    rpc: (nome: string) => Promise.resolve(nome in cenario.rpc ? { data: cenario.rpc[nome], error: null } : FALHA),
    from: (tabela: string) => {
      let colunas = '';
      const resposta = () => {
        if (tabela === 'configuracoes') {
          if (colunas.includes('cotacao_usd_brl')) return cenario.cotacao ? { data: { cotacao_usd_brl: 5 }, error: null } : FALHA;
          return {
            data: {
              agente_pausado: cenario.pausado, teto_ia_usd: 50, minutos_alerta_fila: 30,
              horario_inicio: '08:00:00', horario_fim: '18:00:00', dias_uteis: [1, 2, 3, 4, 5],
            },
            error: null,
          };
        }
        if (tabela === 'feriados') return { data: [], error: null };
        return FALHA;
      };
      const cadeia: Record<string, unknown> = {};
      for (const m of ['eq', 'neq', 'gte', 'lt', 'in', 'is', 'not', 'order', 'limit']) cadeia[m] = () => cadeia;
      cadeia.select = (c: string) => { colunas = c; return cadeia; };
      cadeia.maybeSingle = () => Promise.resolve(resposta());
      cadeia.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve(resposta()).then(ok, erro);
      return cadeia;
    },
  };
}
vi.mock('@/lib/supabase/servidor', () => ({ supabaseServidor: async () => clienteFalso() }));

let n = 0;
// Um id por teste: a memória de 60 s do gasto (gasto-do-mes.ts) é por pessoa.
const pessoa = () => ({ id: `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}` }) as UsuarioPainel;

beforeEach(() => {
  Object.assign(cenario, { pausado: false, cotacao: false, rpc: {} });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Cartão do agente sem as migrações novas (D21)', () => {
  it('sem cotação, sem gasto e sem estado_sistema_resumo: mostra o estado e o PAUSAR, sem afirmar o teto', async () => {
    const html = renderToStaticMarkup(await CartaoAgente({ u: pessoa() }));
    expect(html).not.toContain('não pôde ser lido');
    expect(html).toContain('data-estado-agente="atendendo"');
    expect(html).toContain('Pausar agente');
    expect(html).toContain('o teto de IA não pôde ser conferido agora');
  });
  it('pausado: RETOMAR continua', async () => {
    cenario.pausado = true;
    const html = renderToStaticMarkup(await CartaoAgente({ u: pessoa() }));
    expect(html).toContain('data-estado-agente="pausado"');
    expect(html).toContain('Retomar agente');
  });
  it('sem o gasto, o teto vem da estado_sistema_resumo', async () => {
    cenario.rpc = { estado_sistema_resumo: { agente_pausado: false, teto_atingido: true, whatsapp_conectado: true, trabalhador_ok: true } };
    const html = renderToStaticMarkup(await CartaoAgente({ u: pessoa() }));
    expect(html).toContain('data-estado-agente="teto"');
    expect(html).toContain('Pausar agente');
  });
  it('com o gasto lido, o teto é a soma do mês e não há ressalva', async () => {
    cenario.rpc = { gastos_resumo: { total_usd: 10 } };
    const html = renderToStaticMarkup(await CartaoAgente({ u: pessoa() }));
    expect(html).toContain('data-estado-agente="atendendo"');
    expect(html).not.toContain('não pôde ser conferido');
  });
});

describe('Cartão do gasto', () => {
  it('sem a coluna da cotação: mostra em dólar, sem R$', async () => {
    cenario.rpc = { gastos_resumo: { total_usd: 2.31 } };
    const html = renderToStaticMarkup(await CartaoGasto({ u: pessoa() }));
    expect(html).toContain('2,31');
    expect(html).not.toContain('R$');
    expect(html).toContain('Ver Gastos com IA');
  });
  it('com a cotação: mostra o valor em reais', async () => {
    Object.assign(cenario, { cotacao: true, rpc: { gastos_resumo: { total_usd: 2 } } });
    const html = renderToStaticMarkup(await CartaoGasto({ u: pessoa() }));
    expect(html).toContain('R$');
  });
});

describe('Cinco números sem a demandas_por_setor (D21)', () => {
  it('os quatro cartões de demandas dizem "indisponível" e as leituras que falharam ficam no log', async () => {
    const html = renderToStaticMarkup(await NumerosSituacao());
    expect(html.match(/indisponível: falta a atualização do banco/g)).toHaveLength(4);
    const logs = vi.mocked(console.error).mock.calls.map((c) => String(c[0]));
    expect(logs).toEqual(expect.arrayContaining([
      '[inicio] falha ao ler as vencidas', '[inicio] falha ao ler as que vencem hoje', '[inicio] falha ao contar as sem responsável antigas',
    ]));
  });
});
