import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AVISO_SEM_ACESSO_PEDIDO } from '@/lib/pedido-nota';
import { PREFIXO_GRAVADO } from '@/lib/pedido-assistente';

vi.mock('server-only', () => ({}));

// Banco falso: cada consulta grava os métodos chamados; o cenário de cada teste decide a resposta olhando a consulta.
type Op = [string, unknown[]];
type Consulta = { tabela: string; ops: Op[] };
const cenario = { responder: (_c: Consulta): unknown => ({ data: null, error: { code: 'XX000', message: 'sem cenário' } }), consultas: [] as Consulta[] };

function clienteFalso() {
  return {
    from: (tabela: string) => {
      const c: Consulta = { tabela, ops: [] };
      cenario.consultas.push(c);
      const cadeia: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'is', 'not', 'in', 'order', 'limit']) {
        cadeia[m] = (...a: unknown[]) => { c.ops.push([m, a]); return cadeia; };
      }
      cadeia.maybeSingle = () => Promise.resolve(cenario.responder(c));
      cadeia.then = (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve(cenario.responder(c)).then(ok, erro);
      return cadeia;
    },
  };
}

const { lerDemandaDoPedido, lerHistoricoAssistente, lerMensagensAssistente } = await import('./dados-assistente');
const sb = () => clienteFalso() as never;
const tem = (c: Consulta, m: string, ...a: unknown[]) => c.ops.some(([n, args]) => n === m && JSON.stringify(args) === JSON.stringify(a));

beforeEach(() => {
  cenario.consultas = [];
  vi.spyOn(console, 'error').mockReset().mockImplementation(() => {});
});

describe('lerMensagensAssistente', () => {
  it('Geral: sem conversa, só do site, as 60 mais novas, devolvidas da mais antiga para a mais nova', async () => {
    cenario.responder = () => ({ data: [{ id: 'b', criado_em: '2' }, { id: 'a', criado_em: '1' }], error: null });
    const r = await lerMensagensAssistente(sb(), 'u1', null);
    expect(r.map((m) => m.id)).toEqual(['a', 'b']);
    const [c] = cenario.consultas;
    expect(tem(c!, 'eq', 'usuario_id', 'u1') && tem(c!, 'eq', 'canal', 'site') && tem(c!, 'is', 'conversa_id', null)).toBe(true);
    expect(tem(c!, 'order', 'criado_em', { ascending: false }) && tem(c!, 'limit', 60)).toBe(true);
  });
  it('com conversa: filtra por ela', async () => {
    cenario.responder = () => ({ data: [], error: null });
    await lerMensagensAssistente(sb(), 'u1', 'c1');
    expect(tem(cenario.consultas[0]!, 'eq', 'conversa_id', 'c1')).toBe(true);
  });
});

describe('lerHistoricoAssistente', () => {
  it('só as conversas que a pessoa ainda vê (RLS de conversas); a aberta vem junto', async () => {
    cenario.responder = (c) => {
      if (c.tabela === 'assistente_mensagens' && tem(c, 'is', 'conversa_id', null)) return { data: { criado_em: '2026-10-10T18:00:00Z' }, error: null };
      if (c.tabela === 'assistente_mensagens') return { data: [
        { conversa_id: 'c1', criado_em: '3' }, { conversa_id: 'c2', criado_em: '2' }, { conversa_id: 'c1', criado_em: '1' },
      ], error: null };
      if (c.tabela === 'conversas') return { data: [{ id: 'c1', telefone: '5531999990001', contatos: { nome: 'Carla' }, clientes: { razao_social: 'Padaria', nome_fantasia: null } }], error: null };
      return { data: null, error: null };
    };
    const r = await lerHistoricoAssistente(sb(), 'u1', 'c1');
    expect(r.ultimaGeral).toBe('2026-10-10T18:00:00Z');
    expect(r.conversas).toEqual([{ id: 'c1', nome: 'Carla', empresa: 'Padaria', ultimaEm: '3', mensagens: 2 }]);
    expect(r.aberta?.id).toBe('c1');
  });
});

const LINHA = {
  id: 'd1', numero: 536, titulo: 'NF de venda', setor: 'Fiscal', empresa: 'Padaria Sol ME', status: 'aberto', origem: 'agente',
  contato: 'Carla', criado_em: '2026-10-01T13:00:00Z', criado_por_nome: null, tem_pedido: true,
};
const EVENTOS = [
  { tipo: 'criacao', texto: 'resumo', criado_em: '2026-10-01T13:00:00Z', usuario_id: null, usuarios: null },
  { tipo: 'nota_interna', texto: `${PREFIXO_GRAVADO}Ana.\nAntes:\n10\nDepois:\n15`, criado_em: '2026-10-10T18:41:00Z', usuario_id: 'u1', usuarios: { nome: 'Ana' } },
];

describe('lerDemandaDoPedido (D17)', () => {
  it('pelo número, em demandas_lista (regra de leitura de quem consulta), com os eventos em ordem', async () => {
    cenario.responder = (c) => (c.tabela === 'demandas_lista' ? { data: LINHA, error: null } : { data: EVENTOS, error: null });
    const r = await lerDemandaDoPedido(sb(), 536, true);
    expect(r.estado).toBe('ok');
    if (r.estado !== 'ok') return;
    expect(r.demanda).toEqual({ id: 'd1', numero: 536, titulo: 'NF de venda', setor: 'Fiscal', empresa: 'Padaria Sol ME', status: 'aberto',
      origem: 'agente', contato: 'Carla', criadoEm: '2026-10-01T13:00:00Z', criadoPorNome: null });
    expect(r.eventos[1]).toEqual({ tipo: 'nota_interna', texto: EVENTOS[1]!.texto, criado_em: '2026-10-10T18:41:00Z', usuario_id: 'u1', usuario: 'Ana' });
    expect(tem(cenario.consultas[0]!, 'eq', 'numero', 536)).toBe(true);
    expect(tem(cenario.consultas[1]!, 'eq', 'chamado_id', 'd1') && tem(cenario.consultas[1]!, 'order', 'criado_em')).toBe(true);
    // O pedido em si nunca é lido do banco (D2).
    expect(JSON.stringify(cenario.consultas[0]!.ops)).not.toContain('pedido_venda');
  });

  it('"Pedidos de nota: Sem acesso": textos livres dos eventos escondidos (P11)', async () => {
    cenario.responder = (c) => (c.tabela === 'demandas_lista' ? { data: LINHA, error: null } : { data: EVENTOS, error: null });
    const r = await lerDemandaDoPedido(sb(), 536, false);
    expect(r.estado === 'ok' && r.eventos.map((e) => e.texto)).toEqual(['resumo', AVISO_SEM_ACESSO_PEDIDO]);
  });

  it('fora das que a pessoa vê: "fora"; erro na leitura: "falha", com log', async () => {
    cenario.responder = () => ({ data: null, error: null });
    expect(await lerDemandaDoPedido(sb(), 536, true)).toEqual({ estado: 'fora' });
    cenario.responder = () => ({ data: null, error: { code: '57014', message: 'timeout' } });
    expect(await lerDemandaDoPedido(sb(), 536, true)).toEqual({ estado: 'falha' });
    expect(vi.mocked(console.error)).toHaveBeenCalled();
  });

  it('eventos que falham não derrubam a demanda: lista vazia, com log', async () => {
    cenario.responder = (c) => (c.tabela === 'demandas_lista' ? { data: LINHA, error: null } : { data: null, error: { code: 'XX000', message: 'x' } });
    const r = await lerDemandaDoPedido(sb(), 536, true);
    expect(r.estado === 'ok' && r.eventos).toEqual([]);
    expect(vi.mocked(console.error)).toHaveBeenCalled();
  });
});
