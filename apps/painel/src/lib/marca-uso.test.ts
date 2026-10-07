import { describe, expect, it } from 'vitest';
import { cookieDeUso, INTERVALO_MARCA_USO_MS } from './marca-uso';

// Verificação final: a tela grava o último toque da pessoa no relógio do servidor (sessao-limites.ts, momentoDoUso).
describe('cookieDeUso', () => {
  it('grava o momento corrigido pela diferença de relógio, para o painel inteiro, por até 12 h', () => {
    expect(cookieDeUso({ agoraNavegador: 1000, desvioMs: 500, https: false })).toBe('painel_uso=1500; path=/; max-age=43200; samesite=lax');
  });
  it('em https vai com secure; relógio do navegador adiantado também é corrigido', () => {
    expect(cookieDeUso({ agoraNavegador: 10_000, desvioMs: -4000, https: true })).toBe('painel_uso=6000; path=/; max-age=43200; samesite=lax; secure');
  });
  it('não regrava a cada tecla', () => {
    expect(INTERVALO_MARCA_USO_MS).toBe(5000);
  });
});
