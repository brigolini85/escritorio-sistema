import { describe, expect, it } from 'vitest';
import { LIMITES_BATIMENTO } from './inicio';
import { deveRecarregar, RECARGA_AO_VOLTAR_MS, RECARGA_PERIODICA_MS } from './recarga';

describe('deveRecarregar', () => {
  it('recarrega com a aba visível depois do intervalo', () => {
    expect(deveRecarregar({ visivel: true, desdeUltimaMs: RECARGA_PERIODICA_MS, minimoMs: RECARGA_PERIODICA_MS })).toBe(true);
    expect(deveRecarregar({ visivel: true, desdeUltimaMs: RECARGA_PERIODICA_MS - 1, minimoMs: RECARGA_PERIODICA_MS })).toBe(false);
  });
  it('nunca recarrega com a aba escondida', () => {
    expect(deveRecarregar({ visivel: false, desdeUltimaMs: 10 * RECARGA_PERIODICA_MS, minimoMs: RECARGA_PERIODICA_MS })).toBe(false);
  });
  it('ao voltar para a aba, só recarrega se a última recarga não é recente', () => {
    expect(deveRecarregar({ visivel: true, desdeUltimaMs: 5_000, minimoMs: RECARGA_AO_VOLTAR_MS })).toBe(false);
    expect(deveRecarregar({ visivel: true, desdeUltimaMs: RECARGA_AO_VOLTAR_MS, minimoMs: RECARGA_AO_VOLTAR_MS })).toBe(true);
  });
  it('o intervalo fica abaixo do limite de "atrasado" dos batimentos', () => {
    expect(RECARGA_PERIODICA_MS).toBeLessThan(LIMITES_BATIMENTO.atrasadoApos * 1000);
  });
});
