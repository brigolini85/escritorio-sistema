import { describe, expect, it, vi } from 'vitest';
import { contarConversasAguardando, contarDemandasAbertas, descricaoContador, deveAvisarNovaConversa, lerPausaDoResumo, rotuloContador } from './contadores';

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
  it('conversas aguardando = caixa_entrada esperando você (P2)', async () => {
    const { sb, chamadas } = falso({ count: 3, error: null });
    expect(await contarConversasAguardando(sb)).toBe(3);
    expect(chamadas).toEqual([['from', 'caixa_entrada'], ['select', 'id', { count: 'exact', head: true }], ['eq', 'esperando_voce', true]]);
  });
  it('demandas abertas = chamados não concluídos (RLS decide quais)', async () => {
    const { sb, chamadas } = falso({ count: 0, error: null });
    expect(await contarDemandasAbertas(sb)).toBe(0);
    expect(chamadas).toContainEqual(['neq', 'status', 'concluido']);
  });
  it('erro de leitura vira null (contador some, a casca não quebra)', async () => {
    expect(await contarDemandasAbertas(falso({ count: null, error: { message: 'x' } }).sb)).toBeNull();
  });
  it('pausa geral pela estado_sistema_resumo (sem custo; a casca no navegador não lê configuracoes)', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { agente_pausado: true, teto_atingido: false }, error: null });
    expect(await lerPausaDoResumo({ rpc } as never)).toBe(true);
    expect(rpc).toHaveBeenCalledWith('estado_sistema_resumo');
    expect(await lerPausaDoResumo({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) } as never)).toBeNull();
    expect(await lerPausaDoResumo({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'x' } }) } as never)).toBeNull();
  });
  it('rótulo e descrição', () => {
    expect(rotuloContador(0)).toBeNull();
    expect(rotuloContador(null)).toBeNull();
    expect(rotuloContador(7)).toBe('7');
    expect(rotuloContador(120)).toBe('99+');
    expect(descricaoContador('atendimento', 1)).toBe('1 conversa esperando você');
    expect(descricaoContador('atendimento', 4)).toBe('4 conversas esperando você');
    expect(descricaoContador('demandas', 1)).toBe('1 demanda aberta');
    expect(descricaoContador('demandas', 2)).toBe('2 demandas abertas');
  });
  it('aviso de conversa nova só quando sobe e a pessoa não acabou de agir', () => {
    expect(deveAvisarNovaConversa(3, 4, 10_000)).toBe(true);
    expect(deveAvisarNovaConversa(3, 4, 1_000)).toBe(false);
    expect(deveAvisarNovaConversa(4, 4, 10_000)).toBe(false);
    expect(deveAvisarNovaConversa(4, 3, 10_000)).toBe(false);
    expect(deveAvisarNovaConversa(null, 4, 10_000)).toBe(false);
  });
});
