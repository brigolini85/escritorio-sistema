import { describe, expect, it, vi } from 'vitest';

const falso = vi.hoisted(() => ({
  criados: 0,
  start: vi.fn<() => Promise<void>>(),
  send: vi.fn(async () => 'job-1'),
  filas: new Map<string, unknown>(),
}));
vi.mock('server-only', () => ({}));
vi.mock('pg-boss', () => ({
  default: class {
    constructor() { falso.criados++; }
    on() {}
    start() { return falso.start(); }
    async createQueue(nome: string, opcoes: unknown) { falso.filas.set(nome, opcoes); }
    send(...a: unknown[]) { return (falso.send as (...x: unknown[]) => Promise<string>)(...a); }
  },
}));

import { enfileirarAssistente, enfileirarEnvio, enfileirarSimulacao, enfileirarSugestao } from './fila';

describe('fila do painel (revisão final, E4)', () => {
  it('se a conexão falhar, a próxima chamada tenta de novo em vez de repetir o erro', async () => {
    falso.start.mockRejectedValueOnce(new Error('banco fora do ar')).mockResolvedValue(undefined);
    await expect(enfileirarEnvio('m1')).rejects.toThrow('banco fora do ar');
    await enfileirarEnvio('m2');
    expect(falso.criados).toBe(2);
    expect(falso.send).toHaveBeenCalledWith('enviar-mensagem', { mensagemId: 'm2' });
    // Conectado: a conexão é reaproveitada.
    await enfileirarEnvio('m3');
    expect(falso.criados).toBe(2);
  });

  it('teste do agente: fila simular_agente igual à do trabalhador e chave única pelo id da simulação', async () => {
    await enfileirarSimulacao('sim-1');
    expect(falso.filas.get('simular_agente')).toEqual({ name: 'simular_agente', policy: 'stately', retryLimit: 2, retryDelay: 15, retryBackoff: true });
    expect(falso.send).toHaveBeenLastCalledWith('simular_agente', { simulacaoId: 'sim-1' }, { singletonKey: 'sim-1' });
  });

  it('sugerir resposta: fila sugerir_resposta igual à do trabalhador e chave única pelo id da sugestão', async () => {
    await enfileirarSugestao('sug-1');
    expect(falso.filas.get('sugerir_resposta')).toEqual({ name: 'sugerir_resposta', policy: 'stately', retryLimit: 1, retryDelay: 5 });
    expect(falso.send).toHaveBeenLastCalledWith('sugerir_resposta', { sugestaoId: 'sug-1' }, { singletonKey: 'sug-1' });
  });

  it('assistente: fila igual à do trabalhador ("short", revisão geral I1) e chave por pessoa e contexto', async () => {
    await enfileirarAssistente({ usuarioId: 'u1', conversaId: null });
    expect(falso.filas.get('assistente')).toEqual({ name: 'assistente', policy: 'short', retryLimit: 3, retryDelay: 20, retryBackoff: true });
    expect(falso.send).toHaveBeenLastCalledWith('assistente', { usuarioId: 'u1', canal: 'site', conversaId: null, telefone: null }, { singletonKey: 'u1:site:-' });
  });
});
