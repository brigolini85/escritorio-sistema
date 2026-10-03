import { describe, expect, it, vi } from 'vitest';
import { alertasDaFaixa, lerGastoIaDoMes, lerSinaisVida, mesCorrenteSP, situacaoTeto } from './inicio';

/** Cliente falso: cada `await` da cadeia devolve a próxima resposta da lista. */
function falso(respostas: unknown[]) {
  const chamadas: unknown[][] = [];
  let i = 0;
  const cadeia: Record<string, unknown> = {};
  for (const m of ['select', 'gte', 'lt', 'order', 'range', 'head']) cadeia[m] = (...a: unknown[]) => { chamadas.push([m, ...a]); return cadeia; };
  cadeia.then = (ok: (v: unknown) => unknown) => Promise.resolve(respostas[i++]).then(ok);
  return { sb: { from: (t: string) => { chamadas.push(['from', t]); return cadeia; } } as never, chamadas };
}

describe('mesCorrenteSP', () => {
  it('usa o mês de Brasília (virada de mês e de ano)', () => {
    expect(mesCorrenteSP(new Date('2026-09-30T12:00:00Z'))).toEqual({ inicio: '2026-09-01T00:00:00-03:00', fim: '2026-10-01T00:00:00-03:00' });
    // 01/10 às 01:00 UTC ainda é 30/09 em Brasília
    expect(mesCorrenteSP(new Date('2026-10-01T01:00:00Z')).inicio).toBe('2026-09-01T00:00:00-03:00');
    expect(mesCorrenteSP(new Date('2026-12-15T12:00:00Z')).fim).toBe('2027-01-01T00:00:00-03:00');
  });
});

describe('situacaoTeto', () => {
  it('ok abaixo de 80%, perto a partir de 80%, atingido em 100%', () => {
    expect(situacaoTeto(10, 50).nivel).toBe('ok');
    expect(situacaoTeto(40, 50)).toMatchObject({ nivel: 'perto', fracao: 0.8 });
    expect(situacaoTeto(50, 50).nivel).toBe('atingido');
    expect(situacaoTeto(0, 0).nivel).toBe('atingido');
  });
});

describe('lerGastoIaDoMes', () => {
  it('lê o total do mês pela gastos_resumo', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { total_usd: 41.2 }, error: null });
    expect(await lerGastoIaDoMes({ rpc } as never, new Date('2026-10-15T15:00:00Z'))).toEqual({ total: 41.2, parcial: false });
    expect(rpc).toHaveBeenCalledWith('gastos_resumo', { p_de: '2026-10-01T00:00:00-03:00', p_ate: '2026-11-01T00:00:00-03:00' });
  });
  it('total em texto (numeric do PostgREST) vira número', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { total_usd: '12.5' }, error: null });
    expect(await lerGastoIaDoMes({ rpc } as never, new Date())).toEqual({ total: 12.5, parcial: false });
  });
  it('quem não é administrador: null', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'Só o administrador vê os gastos com IA.' } });
    expect(await lerGastoIaDoMes({ rpc } as never, new Date())).toBeNull();
  });
});

describe('lerSinaisVida', () => {
  it('por componente, com o mais recente', async () => {
    const { sb } = falso([{ data: [{ componente: 'fila', visto_em: '2026-09-30T12:00:00Z' }, { componente: 'whatsapp', visto_em: '2026-09-30T11:00:00Z' }], error: null }]);
    expect(await lerSinaisVida(sb)).toEqual({ fila: '2026-09-30T12:00:00Z', whatsapp: '2026-09-30T11:00:00Z', ultimo: '2026-09-30T12:00:00Z' });
  });
});

describe('alertasDaFaixa', () => {
  const agora = new Date('2026-09-30T12:00:00Z');
  const ha = (s: number) => new Date(agora.getTime() - s * 1000).toISOString();
  const ok = { fila: ha(30), whatsapp: ha(30), ultimo: ha(30) };
  it('nada errado: faixa vazia', () => {
    expect(alertasDaFaixa({ teto: situacaoTeto(1, 50), sinais: ok, agora })).toEqual([]);
    expect(alertasDaFaixa({ teto: null, sinais: null, agora })).toEqual([]);
  });
  it('teto perto e atingido', () => {
    expect(alertasDaFaixa({ teto: situacaoTeto(45, 50), sinais: ok, agora })[0]).toMatchObject({ id: 'teto', nivel: 'atencao' });
    expect(alertasDaFaixa({ teto: situacaoTeto(50, 50), sinais: ok, agora })[0]).toMatchObject({ id: 'teto', nivel: 'perigo', titulo: 'Teto de gasto com IA atingido' });
  });
  it('WhatsApp sem sinal com a fila batendo: aviso neutro com o tempo', () => {
    expect(alertasDaFaixa({ teto: null, sinais: { ...ok, whatsapp: ha(400) }, agora })[0]!.titulo).toBe('Sem sinal do WhatsApp há 6 min');
    expect(alertasDaFaixa({ teto: null, sinais: { ...ok, whatsapp: ha(400) }, agora }).map((a) => a.id)).toEqual(['whatsapp']);
    expect(alertasDaFaixa({ teto: null, sinais: { ...ok, whatsapp: ha(200) }, agora })).toEqual([]); // só atrasado
  });
  it('fila parada esconde o aviso do WhatsApp (os dois vêm do batimento)', () => {
    expect(alertasDaFaixa({ teto: null, sinais: { fila: null, whatsapp: null, ultimo: null }, agora }).map((a) => a.id)).toEqual(['fila']);
  });
});
