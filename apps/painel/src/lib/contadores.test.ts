import { describe, expect, it } from 'vitest';
import { contarConversasAguardando, contarDemandasAbertas, descricaoContador, lerAgentePausado, rotuloContador } from './contadores';

/** Cliente falso: registra tabela e filtros e devolve a resposta dada. */
function falso(resposta: Record<string, unknown>) {
  const chamadas: unknown[][] = [];
  const cadeia: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'neq', 'maybeSingle']) {
    cadeia[m] = (...args: unknown[]) => { chamadas.push([m, ...args]); return m === 'maybeSingle' ? Promise.resolve(resposta) : cadeia; };
  }
  cadeia.then = (ok: (v: unknown) => unknown) => Promise.resolve(resposta).then(ok);
  const sb = { from: (t: string) => { chamadas.push(['from', t]); return cadeia; } };
  return { sb: sb as never, chamadas };
}

describe('contadores', () => {
  it('conversas aguardando = caixa_entrada com demanda sem responsável', async () => {
    const { sb, chamadas } = falso({ count: 3, error: null });
    expect(await contarConversasAguardando(sb)).toBe(3);
    expect(chamadas).toEqual([['from', 'caixa_entrada'], ['select', 'id', { count: 'exact', head: true }], ['eq', 'sem_responsavel', true]]);
  });
  it('demandas abertas = chamados não concluídos (RLS decide quais)', async () => {
    const { sb, chamadas } = falso({ count: 0, error: null });
    expect(await contarDemandasAbertas(sb)).toBe(0);
    expect(chamadas).toContainEqual(['neq', 'status', 'concluido']);
  });
  it('erro de leitura vira null (contador some, a casca não quebra)', async () => {
    expect(await contarDemandasAbertas(falso({ count: null, error: { message: 'x' } }).sb)).toBeNull();
    expect(await lerAgentePausado(falso({ data: null, error: null }).sb)).toBeNull();
    expect(await lerAgentePausado(falso({ data: { agente_pausado: true }, error: null }).sb)).toBe(true);
  });
  it('rótulo e descrição', () => {
    expect(rotuloContador(0)).toBeNull();
    expect(rotuloContador(null)).toBeNull();
    expect(rotuloContador(7)).toBe('7');
    expect(rotuloContador(120)).toBe('99+');
    expect(descricaoContador('atendimento', 1)).toBe('1 conversa aguardando atendimento');
    expect(descricaoContador('atendimento', 4)).toBe('4 conversas aguardando atendimento');
    expect(descricaoContador('demandas', 1)).toBe('1 demanda aberta');
    expect(descricaoContador('demandas', 2)).toBe('2 demandas abertas');
  });
});
