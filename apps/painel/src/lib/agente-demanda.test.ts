import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { lerTrabalhoDoAgente, textoDaSugestao, textoDaDecisao } = await import('./agente-demanda');

const PRE = { versao: 1, linhas: [{ situacao: 'falta', texto: 'Destinatário sem CNPJ.' }], contagem: { falta: 1, atencao: 0, ok: 0 } };
function sb(r: { pre?: { data: unknown; error: unknown }; sug?: { data: unknown; error: unknown } }) {
  const consulta = (res: { data: unknown; error: unknown }) => {
    const q = { select: () => q, eq: () => q, order: async () => res, maybeSingle: async () => res };
    return q;
  };
  return { from: (t: string) => consulta(t === 'pre_analises_nota' ? r.pre ?? { data: null, error: null } : r.sug ?? { data: [], error: null }) };
}

describe('o trabalho do agente na demanda (D9, D19)', () => {
  it('pré-análise e sugestões, com o nome do agente e o texto pronto', async () => {
    const t = await lerTrabalhoDoAgente(sb({
      pre: { data: { resultado: PRE, agentes: { nome: 'Agente Fiscal' } }, error: null },
      sug: { data: [{ id: 's1', tipo: 'correcao', conteudo: { campo: 'quantidade', de: '10', para: '12', motivo: 'o cliente corrigiu' }, estado: 'aguardando',
        criado_em: '2026-10-05T12:00:00Z', decidida_em: null, agentes: { nome: 'Agente Fiscal' }, decisor: null }], error: null },
    }) as never, 'c1', true);
    expect(t).toEqual({ preAnalise: PRE, agente: 'Agente Fiscal', semI2: false, sugestoes: [{ id: 's1', tipo: 'correcao', agente: 'Agente Fiscal',
      texto: 'Corrigir quantidade: 10 → 12. Motivo: o cliente corrigiu', estado: 'aguardando', criadaEm: '2026-10-05T12:00:00Z', decididaPor: null, decididaEm: null }] });
  });
  it('sem "Pedidos de nota": sem pré-análise (nem pergunta ao banco)', async () => {
    const t = await lerTrabalhoDoAgente(sb({ pre: { data: { resultado: PRE, agentes: { nome: 'Agente Fiscal' } }, error: null } }) as never, 'c1', false);
    expect(t.preAnalise).toBeNull();
  });
  it('sem "Pedidos de nota": sugestões de demanda sem pedido continuam aparecendo (F5)', async () => {
    const t = await lerTrabalhoDoAgente(sb({ sug: { data: [{ id: 's1', tipo: 'nota_interna', conteudo: { texto: 'x' }, estado: 'aguardando',
      criado_em: '2026-10-05T12:00:00Z', decidida_em: null, agentes: { nome: 'A' }, decisor: null }], error: null } }) as never, 'c1', false);
    expect(t.sugestoes.map((s) => s.id)).toEqual(['s1']);
    expect(t.preAnalise).toBeNull();
  });
  it('sem "Pedidos de nota", demanda com pedido: a RLS devolve vazio e nada aparece (F5)', async () => {
    expect(await lerTrabalhoDoAgente(sb({}) as never, 'c1', false)).toEqual({ preAnalise: null, agente: null, sugestoes: [], semI2: false });
  });
  it('formato estranho no banco: sem pré-análise; banco sem a I2: nada, com semI2', async () => {
    expect((await lerTrabalhoDoAgente(sb({ pre: { data: { resultado: { versao: 9 } }, error: null } }) as never, 'c1', true)).preAnalise).toBeNull();
    expect(await lerTrabalhoDoAgente(sb({ sug: { data: null, error: { code: '42P01', message: 'não existe' } } }) as never, 'c1', true))
      .toEqual({ preAnalise: null, agente: null, sugestoes: [], semI2: true });
  });
  it('textoDaSugestao: nota interna é o texto; correção sem "de" usa —', () => {
    expect(textoDaSugestao('nota_interna', { texto: ' Conferir CFOP. ' })).toBe('Conferir CFOP.');
    expect(textoDaSugestao('correcao', { campo: 'CFOP', para: '5.405', motivo: 'venda para fora' })).toBe('Corrigir CFOP: — → 5.405. Motivo: venda para fora');
  });
});

describe('quem e quando decidiu', () => {
  it('com nome e hora de Brasília; sem nome só a hora', () => {
    expect(textoDaDecisao({ estado: 'aprovada', decididaPor: 'Ana', decididaEm: '2026-10-05T12:00:00Z' })).toBe('Aprovada por Ana em 05/10/2026 às 09:00');
    expect(textoDaDecisao({ estado: 'descartada', decididaPor: null, decididaEm: '2026-10-05T12:00:00Z' })).toBe('Descartada em 05/10/2026 às 09:00');
  });
});
