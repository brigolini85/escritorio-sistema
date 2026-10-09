import { describe, expect, it } from 'vitest';
import { hrefVerAnteriores, inicioDoDiaSaoPaulo, lerCursorAnteriores, lerMensagensDaConversa, MENSAGENS_POR_PAGINA } from './mensagens-conversa';

type Linha = { id: string; conversa_id: string; criado_em: string };

/**
 * Dublê do PostgREST só com o que a leitura usa (eq, lt, gte, order, limit, range) e o corte de max_rows (1000),
 * que devolve só as primeiras 1000 da ordem pedida, sem erro (auditoria 6.6).
 */
function bancoFalso(linhas: Linha[], maxRows = 1000) {
  const consultas: string[] = [];
  const sb = {
    from(tabela: string) {
      const filtros: ((l: Linha) => boolean)[] = [];
      const ordens: { col: keyof Linha; asc: boolean }[] = [];
      let de = 0;
      let ate = Infinity;
      const passos: string[] = [tabela];
      const q = {
        select() { return q; },
        eq(col: keyof Linha, v: string) { passos.push(`eq ${col}`); filtros.push((l) => l[col] === v); return q; },
        lt(col: keyof Linha, v: string) { passos.push(`lt ${col}`); filtros.push((l) => l[col] < v); return q; },
        gte(col: keyof Linha, v: string) { passos.push(`gte ${col}`); filtros.push((l) => l[col] >= v); return q; },
        order(col: keyof Linha, o?: { ascending?: boolean }) { ordens.push({ col, asc: o?.ascending ?? true }); return q; },
        limit(n: number) { ate = n - 1; return q; },
        range(a: number, b: number) { de = a; ate = b; return q; },
        then(ok: (r: { data: Linha[]; error: null }) => unknown) {
          consultas.push(passos.join(' '));
          const ordenadas = linhas.filter((l) => filtros.every((f) => f(l))).sort((a, b) => {
            for (const o of ordens) {
              if (a[o.col] !== b[o.col]) return (a[o.col] < b[o.col] ? -1 : 1) * (o.asc ? 1 : -1);
            }
            return 0;
          });
          return Promise.resolve({ data: ordenadas.slice(de, Math.min(ate + 1, de + maxRows)), error: null }).then(ok);
        },
      };
      return q;
    },
  };
  return { sb: sb as never, consultas };
}

const conversa = 'C1';
/** 1.200 mensagens, uma por minuto, a partir de 01/09/2026 12:00 UTC; a última é a "m1199". */
const mensagens = (n = 1200): Linha[] => Array.from({ length: n }, (_, i) => ({
  id: `m${String(i).padStart(4, '0')}`, conversa_id: conversa, criado_em: new Date(Date.UTC(2026, 8, 1, 12, i)).toISOString(),
}));

describe('lerMensagensDaConversa (auditoria 6.6)', () => {
  it('conversa com 1.200 mensagens: abre nas 200 mais novas, em ordem, e a última aparece', async () => {
    const { sb } = bancoFalso([...mensagens(), { id: 'outra', conversa_id: 'C2', criado_em: '2027-01-01T00:00:00.000Z' }]);
    const r = await lerMensagensDaConversa<Linha>(sb, conversa);
    expect(r.erro).toBeNull();
    expect(r.mensagens).toHaveLength(MENSAGENS_POR_PAGINA);
    expect(r.mensagens.at(-1)!.id).toBe('m1199');
    expect(r.mensagens[0]!.id).toBe('m1000');
    expect(r.mensagens.map((m) => m.criado_em)).toEqual([...r.mensagens.map((m) => m.criado_em)].sort());
    expect(r.anteriores).toBe(r.mensagens[0]!.criado_em);
  });

  it('"Ver anteriores" (criado_em < x) vai trazendo as mais antigas sem esconder nenhuma, até a primeira', async () => {
    const todas = mensagens();
    const { sb } = bancoFalso(todas);
    let r = await lerMensagensDaConversa<Linha>(sb, conversa);
    let paginas = 1;
    while (r.anteriores) {
      r = await lerMensagensDaConversa<Linha>(sb, conversa, { antes: r.anteriores });
      paginas++;
      // As mais novas continuam na tela (nada fica escondido, nem passando de 1000 linhas).
      expect(r.mensagens.at(-1)!.id).toBe('m1199');
    }
    expect(paginas).toBe(6);
    expect(r.mensagens.map((m) => m.id)).toEqual(todas.map((m) => m.id));
  });

  it('mensagens no mesmo instante na divisa da página não somem nem repetem', async () => {
    const iguais = Array.from({ length: 5 }, (_, i) => ({ id: `x${i}`, conversa_id: conversa, criado_em: '2026-09-01T12:00:00.000Z' }));
    const { sb } = bancoFalso(iguais);
    const r1 = await lerMensagensDaConversa<Linha>(sb, conversa, { porPagina: 3 });
    expect(r1.mensagens).toHaveLength(3);
    expect(r1.anteriores).toBe('2026-09-01T12:00:00.000Z');
    const r2 = await lerMensagensDaConversa<Linha>(sb, conversa, { antes: r1.anteriores, porPagina: 3 });
    expect(r2.mensagens.map((m) => m.id).sort()).toEqual(['x0', 'x1', 'x2', 'x3', 'x4']);
    expect(r2.anteriores).toBeNull();
  });

  it('poucas mensagens: todas, sem "Ver anteriores"', async () => {
    const { sb } = bancoFalso(mensagens(3));
    const r = await lerMensagensDaConversa<Linha>(sb, conversa);
    expect(r.mensagens.map((m) => m.id)).toEqual(['m0000', 'm0001', 'm0002']);
    expect(r.anteriores).toBeNull();
  });

  it('mensagem nova depois de abrir (atualização ao vivo) aparece no fim, também com "Ver anteriores" aberto', async () => {
    const todas = mensagens();
    const { sb } = bancoFalso(todas);
    const aberta = await lerMensagensDaConversa<Linha>(sb, conversa);
    todas.push({ id: 'nova', conversa_id: conversa, criado_em: '2026-12-01T00:00:00.000Z' });
    expect((await lerMensagensDaConversa<Linha>(sb, conversa)).mensagens.at(-1)!.id).toBe('nova');
    expect((await lerMensagensDaConversa<Linha>(sb, conversa, { antes: aberta.anteriores })).mensagens.at(-1)!.id).toBe('nova');
  });
});

describe('lerCursorAnteriores', () => {
  it('aceita o instante do banco (o "+" que vira espaço na URL também) e recusa o resto', () => {
    expect(lerCursorAnteriores('2026-09-01T12:00:00.123456+00:00')).toBe('2026-09-01T12:00:00.123456+00:00');
    expect(lerCursorAnteriores('2026-09-01T12:00:00.123456 00:00')).toBe('2026-09-01T12:00:00.123456+00:00');
    expect(lerCursorAnteriores('2026-09-01T12:00:00.000Z')).toBe('2026-09-01T12:00:00.000Z');
    expect(lerCursorAnteriores(['2026-09-01T12:00:00Z'])).toBe('2026-09-01T12:00:00Z');
    for (const ruim of [undefined, '', 'ontem', '2026-13-45T99:00:00Z', "2026-09-01T12:00:00Z'),or(1=1"]) expect(lerCursorAnteriores(ruim)).toBeNull();
  });

  it('dia do ?data= vira o começo do dia em São Paulo', () => {
    expect(inicioDoDiaSaoPaulo('2026-09-15')).toBe('2026-09-15T00:00:00-03:00');
  });
});

describe('hrefVerAnteriores (revisão da Task 16)', () => {
  it('mantém filtro, busca, páginas da lista e o dia pedido; o cursor vai codificado', () => {
    const h = hrefVerAnteriores({ conversaId: 'C1', filtro: 'minhas', q: 'joão', mais: 3, data: '2026-09-15', anteriores: '2026-09-01T12:00:00.1+00:00' });
    const u = new URL(h, 'http://x');
    expect(u.pathname).toBe('/atendimento/C1');
    expect(Object.fromEntries(u.searchParams)).toEqual({ filtro: 'minhas', q: 'joão', mais: '3', data: '2026-09-15', anteriores: '2026-09-01T12:00:00.1+00:00' });
  });
  it('sem nada além do cursor', () => {
    expect(hrefVerAnteriores({ conversaId: 'C1', filtro: null, q: '', mais: 1, data: null, anteriores: '2026-09-01T12:00:00Z' }))
      .toBe('/atendimento/C1?anteriores=2026-09-01T12%3A00%3A00Z');
  });
});
