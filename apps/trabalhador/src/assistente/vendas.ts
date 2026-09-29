import type { PedidoVendaSalvo } from '@escritorio/core';

const centavos = (n: number) => Math.round(n * 100) / 100;
const iso = (dma: string, hora: string) => {
  const [d, m, a] = dma.split('/');
  return `${a}-${m}-${d}T${hora}-03:00`;
};

/** Datas digitadas (DD/MM/AAAA, horário de Brasília) em ISO; "até" vai até o fim do dia. */
export function periodoEmIso(de?: string, ate?: string): { de?: string; ate?: string } {
  return { ...(de ? { de: iso(de, '00:00:00') } : {}), ...(ate ? { ate: iso(ate, '23:59:59') } : {}) };
}

export function totalDoPedido(p: PedidoVendaSalvo): number {
  const itens = p.itens.reduce((s, i) => s + (i.quantidade !== null && i.valor_unitario !== null ? i.quantidade * i.valor_unitario : 0), 0);
  return centavos(itens + (p.valor_frete ?? 0));
}

/** Itens que ficam fora do total por não terem preço (ou quantidade). */
export function itensSemPreco(p: PedidoVendaSalvo): number {
  return p.itens.filter((i) => i.quantidade === null || i.valor_unitario === null).length;
}

export function totaisDeVendas(pedidos: { salvo: PedidoVendaSalvo; rede: string }[]) {
  const porRede = new Map<string, { rede: string; pedidos: number; total: number; itensSemPreco: number }>();
  let total = 0;
  let semPreco = 0;
  for (const p of pedidos) {
    const t = totalDoPedido(p.salvo);
    const n = itensSemPreco(p.salvo);
    total += t;
    semPreco += n;
    const r = porRede.get(p.rede) ?? { rede: p.rede, pedidos: 0, total: 0, itensSemPreco: 0 };
    r.pedidos += 1;
    r.total = centavos(r.total + t);
    r.itensSemPreco += n;
    porRede.set(p.rede, r);
  }
  return { pedidos: pedidos.length, total: centavos(total), itensSemPreco: semPreco, porRede: [...porRede.values()].sort((a, b) => b.total - a.total) };
}
