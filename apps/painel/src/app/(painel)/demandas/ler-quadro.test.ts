import { describe, expect, it, vi } from 'vitest';
import { lerFiltrosDemandas } from '@/lib/demandas';
import { lerQuadro } from './ler-quadro';

const EU = '11111111-1111-4111-8111-111111111111';
const AGORA = new Date('2026-10-08T13:00:00Z');

/** Construtor falso: qualquer método encadeia; o `limit` fecha a consulta com a resposta da coluna (pelo status do `.eq`). */
function falso(respostas: Record<string, { data: unknown[] | null; count: number | null; error: { message: string } | null }>) {
  return {
    from: () => {
      let status = '';
      const q: unknown = new Proxy({}, {
        get: (_, nome) => (nome === 'limit'
          ? () => Promise.resolve(respostas[status])
          : (...args: unknown[]) => { if (nome === 'eq' && args[0] === 'status') status = String(args[1]); return q; }),
      });
      return q;
    },
  } as never;
}
const ok = { data: [], count: 0, error: null };

describe('lerQuadro', () => {
  it('sem falha: quatro colunas e erro falso', async () => {
    const r = await lerQuadro(falso({ aberto: ok, em_andamento: ok, aguardando_cliente: ok, concluido: ok }), lerFiltrosDemandas({}, EU), EU, AGORA);
    expect(r.colunas.map((c) => c.status)).toEqual(['aberto', 'em_andamento', 'aguardando_cliente', 'concluido']);
    expect(r.erro).toBe(false);
  });

  it('uma coluna que falha marca o erro (não vira coluna vazia em silêncio)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await lerQuadro(falso({ aberto: ok, em_andamento: { data: null, count: null, error: { message: 'timeout' } }, aguardando_cliente: ok, concluido: ok }), lerFiltrosDemandas({}, EU), EU, AGORA);
    expect(r.erro).toBe(true);
  });
});
