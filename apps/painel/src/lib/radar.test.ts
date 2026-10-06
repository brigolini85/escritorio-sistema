import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { lerFiltroRadar, lerTelaRadar } = await import('./radar');

const S1 = '11111111-1111-4111-8111-111111111111';
const S2 = '22222222-2222-4222-8222-222222222222';
const SUMIU = '99999999-9999-4999-8999-999999999999';
const AGORA = new Date('2026-10-15T15:00:00Z');
type Linha = Record<string, unknown>;
type Erros = Record<string, { code: string; message: string }>;

/** Supabase falso: devolve as linhas por tabela e honra eq, in, gte e head+count. */
function falso(tabelas: Record<string, Linha[]>, erros: Erros = {}, rpcs: Record<string, Linha[]> = {}) {
  return {
    rpc: async (_nome: string, a: { p_novidade: string }) => ({ data: rpcs[a.p_novidade] ?? [], error: null }),
    from: (t: string) => {
      let linhas = tabelas[t] ?? [];
      let head = false;
      const q: Record<string, unknown> = {};
      const fim = () => {
        if (erros[t]) return { data: null, error: erros[t], count: null };
        return { data: head ? null : linhas, error: null, count: linhas.length };
      };
      q.select = (_c: string, o?: { head?: boolean }) => { head = !!o?.head; return q; };
      q.eq = (c: string, v: unknown) => { linhas = linhas.filter((l) => l[c] === v); return q; };
      q.in = (c: string, v: unknown[]) => { linhas = linhas.filter((l) => v.includes(l[c])); return q; };
      q.gte = (c: string, v: string) => { linhas = linhas.filter((l) => new Date(String(l[c])) >= new Date(v)); return q; };
      q.order = () => q;
      q.limit = () => q;
      q.maybeSingle = async () => ({ ...fim(), data: linhas[0] ?? null });
      q.then = (ok: (r: unknown) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(fim()).then(ok, ko);
      return q;
    },
  };
}
const nov = (id: string, o: Linha = {}): Linha => ({
  id, titulo: 'Novo prazo do eSocial', url: 'https://gov.br/x', fonte_nome: 'eSocial', selo: 'oficial', publicado_em: '2026-10-14', achado_em: '2026-10-15T10:00:00Z',
  resumo: 'Muda o prazo de envio.', impacto: 'medio', setores: [S1], criterios: { regimes: ['simples'] }, clientes_afetados: 4, vigencia_texto: null,
  mensagem_cliente: null, estado: 'para_decidir', chamado_id: null, decidida_por: null, decidida_em: null, ...o,
});
const base = (extra: Record<string, Linha[]> = {}) => ({
  radar_config: [{ id: 1, hora: '07:00:00', dias: [1, 2, 3, 4, 5], assuntos: ['Fiscal'], resumo_whatsapp: true, aviso_alto: true, avisar_painel: false, limite_usd_giro: 0.5 }],
  radar_fontes: [], radar_giros: [], radar_novidades: [], radar_envios: [], chamados: [], agentes: [{ slug: 'radar', estado: 'desligado' }],
  setores: [{ id: S1, nome: 'Fiscal', ativo: true }, { id: S2, nome: 'Pessoal', ativo: true }], configuracoes: [{ telefone_dono: '5531999999999' }],
  ...extra,
});
const filtro = { estado: 'para_decidir' as const, setor: null, impacto: null, q: '' };

describe('tela do Radar', () => {
  it('banco sem a I5: semI5 e o resto vazio, sem lançar (D19)', async () => {
    for (const code of ['42P01', 'PGRST205']) {
      const t = await lerTelaRadar(falso(base(), { radar_config: { code, message: 'x' } }) as never, filtro, AGORA);
      expect(t).toMatchObject({ semI5: true, fontes: [], giros: [], novidades: [] });
    }
  });

  it('ordena por impacto e, no mesmo impacto, os mais recentes primeiro', async () => {
    const sb = falso(base({ radar_novidades: [
      nov('b1', { impacto: 'baixo' }), nov('m-velha', { achado_em: '2026-10-10T10:00:00Z' }), nov('a1', { impacto: 'alto' }),
      nov('m-nova', { achado_em: '2026-10-14T10:00:00Z' }),
    ] }));
    const t = await lerTelaRadar(sb as never, filtro, AGORA);
    expect(t.novidades.map((n) => n.id)).toEqual(['a1', 'm-nova', 'm-velha', 'b1']);
  });

  it('filtra por estado, setor, impacto e busca sem acento nem maiúsculas', async () => {
    const sb = falso(base({ radar_novidades: [
      nov('n1', { titulo: 'Alteração do ICMS em MG', impacto: 'alto', setores: [S1] }),
      nov('n2', { titulo: 'Folha', resumo: 'Reforma da contribuição previdenciária', setores: [S2] }),
      nov('n3', { estado: 'descartada' }),
    ] }));
    const ids = async (f: object) => (await lerTelaRadar(sb as never, { ...filtro, ...f }, AGORA)).novidades.map((n) => n.id);
    expect(await ids({})).toEqual(['n1', 'n2']);
    expect(await ids({ estado: 'descartada' })).toEqual(['n3']);
    expect(await ids({ setor: S2 })).toEqual(['n2']);
    expect(await ids({ impacto: 'alto' })).toEqual(['n1']);
    expect(await ids({ q: 'alteracao do icms' })).toEqual(['n1']);
    expect(await ids({ q: 'ALTERAÇÃO' })).toEqual(['n1']);
    expect(await ids({ q: 'previdenciaria' })).toEqual(['n2']);
  });

  it('setores vêm com o nome; setor que sumiu não aparece', async () => {
    const sb = falso(base({ radar_novidades: [nov('n1', { setores: [S1, SUMIU] })] }));
    const t = await lerTelaRadar(sb as never, filtro, AGORA);
    expect(t.novidades[0]!.setores).toEqual([{ id: S1, nome: 'Fiscal' }]);
    expect(t.setores).toEqual([{ id: S1, nome: 'Fiscal' }, { id: S2, nome: 'Pessoal' }]);
  });

  it('agrega os envios por novidade com a função envios_da_novidade', async () => {
    const sb = falso(base({ radar_novidades: [nov('n1', { estado: 'demanda' })] }), {}, { n1: [
      { estado: 'aguardando', motivo: null, total: 1 }, { estado: 'enviado', motivo: null, total: 2 },
      { estado: 'nao_enviado', motivo: 'limite_dia', total: 1 }, { estado: 'nao_enviado', motivo: 'pausado', total: 2 },
    ] });
    const t = await lerTelaRadar(sb as never, { ...filtro, estado: 'demanda' }, AGORA);
    expect(t.novidades[0]!.envios).toEqual({ enviado: 2, aguardando: 1, naoEnviado: 3, motivos: ['limite_dia', 'pausado'] });
  });

  it('erro de leitura (não de migração) acende erro, sem semI5', async () => {
    const t = await lerTelaRadar(falso(base(), { radar_novidades: { code: '57014', message: 'timeout' } }) as never, filtro, AGORA);
    expect(t).toMatchObject({ semI5: false, erro: true, novidades: [] });
    expect((await lerTelaRadar(falso(base()) as never, filtro, AGORA)).erro).toBe(false);
  });

  it('próximo giro: já rodou hoje (agenda de hoje em São Paulo) pula para o próximo dia', async () => {
    const sem = await lerTelaRadar(falso(base({ radar_giros: [] })) as never, filtro, AGORA);
    const com = await lerTelaRadar(falso(base({ radar_giros: [{ id: 'g', origem: 'agenda', dia: '2026-10-15', criado_em: '2026-10-15T10:00:00Z', custo_usd: 0 }] })) as never, filtro, AGORA);
    // 15/10/2026 é quinta, 12h em SP e depois das 7h: sem giro hoje = agora; com giro = sexta 07h SP
    expect(sem.config.proximoGiro).toBe(AGORA.toISOString());
    expect(com.config.proximoGiro).toBe('2026-10-16T10:00:00.000Z');
  });

  it('mês: custo dos giros, novidades e demandas desde o início do mês em São Paulo', async () => {
    const sb = falso(base({
      radar_giros: [
        { id: 'g1', criado_em: '2026-10-02T10:00:00Z', custo_usd: '0.25' }, { id: 'g2', criado_em: '2026-10-10T10:00:00Z', custo_usd: 0.1 },
        { id: 'gx', criado_em: '2026-10-01T02:00:00Z', custo_usd: 9 },   // 30/09 23h em SP: fora
      ],
      radar_novidades: [
        nov('n1', { achado_em: '2026-10-03T10:00:00Z', estado: 'demanda', decidida_em: '2026-10-04T10:00:00Z' }),
        nov('n2', { achado_em: '2026-10-05T10:00:00Z' }), nov('n3', { achado_em: '2026-09-20T10:00:00Z' }),
      ],
    }));
    const t = await lerTelaRadar(sb as never, filtro, AGORA);
    expect(t.mes.custoUsd).toBeCloseTo(0.35, 6);
    expect(t.mes.novidades).toBe(2);
    expect(t.mes.demandas).toBe(1);
    expect(t.contagem).toEqual({ para_decidir: 2, demanda: 1, descartada: 0 });
  });

  it('chamado: número quando a pessoa enxerga; null quando a RLS esconde', async () => {
    const sb = falso(base({
      radar_novidades: [nov('n1', { estado: 'demanda', chamado_id: 'c1' }), nov('n2', { estado: 'demanda', chamado_id: 'c2' })],
      chamados: [{ id: 'c1', numero: 42 }],
    }));
    const t = await lerTelaRadar(sb as never, { ...filtro, estado: 'demanda' }, AGORA);
    const por = Object.fromEntries(t.novidades.map((n) => [n.id, n.chamado]));
    expect(por.n1).toEqual({ id: 'c1', numero: 42 });
    expect(por.n2).toEqual({ id: 'c2', numero: null });
  });

  it('config, estado do agente e telefone do dono só como booleano', async () => {
    const t = await lerTelaRadar(falso(base()) as never, filtro, AGORA);
    expect(t.semI5).toBe(false);
    expect(t.config).toMatchObject({ hora: '07:00', dias: [1, 2, 3, 4, 5], estado: 'desligado', limiteUsdGiro: 0.5 });
    expect(t.telefoneDono).toBe(true);
    const sem = await lerTelaRadar(falso(base({ configuracoes: [] })) as never, filtro, AGORA);
    expect(sem.telefoneDono).toBe(false);
  });
});

describe('lerFiltroRadar', () => {
  it('valores inválidos voltam ao padrão', () => {
    expect(lerFiltroRadar({ estado: 'xx', impacto: 'alto', setor: 'nao-uuid', q: ' icms ' })).toEqual({ estado: 'para_decidir', impacto: 'alto', setor: null, q: 'icms' });
    expect(lerFiltroRadar({})).toEqual({ estado: 'para_decidir', impacto: null, setor: null, q: '' });
    expect(lerFiltroRadar({ estado: 'demanda', setor: S1 })).toMatchObject({ estado: 'demanda', setor: S1 });
  });
});
