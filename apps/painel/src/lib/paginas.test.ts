import { describe, expect, it } from 'vitest';
import { lerEmPaginas } from './paginas';

const fonte = (total: number) => {
  const pedidos: [number, number][] = [];
  const pagina = async (de: number, ate: number) => {
    pedidos.push([de, ate]);
    return { data: Array.from({ length: Math.max(0, Math.min(ate, total - 1) - de + 1) }, (_, i) => de + i), error: null };
  };
  return { pedidos, pagina };
};

describe('lerEmPaginas', () => {
  it('lê página a página até a primeira incompleta', async () => {
    const f = fonte(2500);
    const r = await lerEmPaginas(f.pagina);
    expect(r.data).toHaveLength(2500);
    expect(r.data.at(-1)).toBe(2499);
    expect(f.pedidos).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(r.parcial).toBe(false);
  });
  it('total múltiplo da página: uma ida a mais, vazia', async () => {
    const f = fonte(4);
    expect((await lerEmPaginas(f.pagina, { porPagina: 2 })).data).toEqual([0, 1, 2, 3]);
    expect(f.pedidos).toHaveLength(3);
  });
  it('para no máximo de páginas e avisa que é parcial', async () => {
    const r = await lerEmPaginas(fonte(100).pagina, { porPagina: 10, maxPaginas: 3 });
    expect(r).toMatchObject({ parcial: true });
    expect(r.data).toHaveLength(30);
  });
  it('devolve o erro de uma página', async () => {
    let n = 0;
    const r = await lerEmPaginas(async () => (n++ === 0 ? { data: [1, 2], error: null } : { data: null, error: 'falhou' }), { porPagina: 2 });
    expect(r).toEqual({ data: [1, 2], error: 'falhou', parcial: false });
  });
});
