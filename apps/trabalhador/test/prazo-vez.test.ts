// Revisão geral I2: a vez que passa do prazo do job era repetida pela fila AO MESMO TEMPO que a original (resposta duplicada).
// Agora a vez da conversa e o giro do Radar param de abrir rodadas antes do prazo do job.
import { describe, expect, it } from 'vitest';
import type { Repos } from '@escritorio/db';
import { TENTATIVAS_EXTRAS_IA, TIMEOUT_IA_MS, limiteDaChamada, type ParametrosIa } from '../src/agente/cliente-ia';
import { executarAgente } from '../src/agente/executar';
import type { ExecutorFerramentas } from '../src/agente/ferramentas';
import { montarConteudoUsuario } from '../src/agente/prompt';
import { EXPIRA_CONVERSA_SEGUNDOS, TRAVA_VEZ_SEGUNDOS } from '../src/fila';
import { PRAZO_VEZ_CONVERSA_MS } from '../src/processar-conversa';
import { PRAZO_GIRO_MS } from '../src/radar/giro';
import { IaRoteirizada, fim, usarFerramentas } from './apoio/ia-roteirizada';
import { CASOS_RETRATO } from './apoio/retrato';

function montar(roteiro: ConstructorParameters<typeof IaRoteirizada>[0], prazoVez: number | undefined) {
  const ctx = CASOS_RETRATO['contato-uma-empresa']!();
  const repos = { registrarUsoIa: async () => {}, ultimasOrientacoesCortadas: async () => null, obterConversa: async () => ctx.conversa,
    registrarDecisao: async () => {} } as unknown as Repos;
  const executor: ExecutorFerramentas = async (_d, estado, nome) => {
    if (nome === 'responder') estado.respondeu = true;
    return { resultado: '{"ok":true}', erro: false };
  };
  const ia = new IaRoteirizada(roteiro);
  const rodar = () => executarAgente({ repos, ia, envio: {} as never, prazoVez }, ctx, montarConteudoUsuario(ctx, [], [], []), executor);
  return { ia, rodar };
}

describe('prazo da vez do agente', () => {
  it('prazo já vencido: não chama a IA e passa para a equipe', async () => {
    const { ia, rodar } = montar([fim()], Date.now() - 1);
    expect(await rodar()).toEqual({ status: 'escalar', motivo: 'tempo esgotado', respondeu: false });
    expect(ia.recebidos).toHaveLength(0);
  });

  it('prazo vence no meio: para de abrir rodadas; o que já respondeu fica', async () => {
    let agora = 1_000;
    const real = Date.now;
    Date.now = () => agora;
    try {
      const { ia, rodar } = montar([
        usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi!' } }),
        usarFerramentas({ nome: 'consultar_chamados', entrada: {} }),
        fim(),
      ], 2_000);
      const original = ia.criar.bind(ia);
      ia.criar = async (p) => { const r = await original(p); agora += 1_500; return r; };
      expect(await rodar()).toEqual({ status: 'ok' });
      expect(ia.recebidos).toHaveLength(1);
    } finally {
      Date.now = real;
    }
  });

  it('sem prazo (simulação, cenários): como antes', async () => {
    const { ia, rodar } = montar([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi!' } }), fim()], undefined);
    expect(await rodar()).toEqual({ status: 'ok' });
    expect(ia.recebidos).toHaveLength(2);
  });

  it('os prazos ficam em ordem: vez < job < trava; giro abaixo do fechamento do banco (40 min)', () => {
    // Uma chamada pode durar até 3 min (60 s x 3 do SDK), e o agente do setor roda dentro de uma ferramenta do Thiago.
    expect(PRAZO_VEZ_CONVERSA_MS + 2 * 3 * 60_000).toBeLessThan(EXPIRA_CONVERSA_SEGUNDOS * 1000);
    expect(EXPIRA_CONVERSA_SEGUNDOS).toBeLessThan(TRAVA_VEZ_SEGUNDOS);
    // Giro: uma chamada do Radar pode durar até 2 x 5 min.
    expect(PRAZO_GIRO_MS + 10 * 60_000).toBeLessThanOrEqual(40 * 60_000);
    // Auditoria 4.16 (M8): mesmo uma chamada inteira (150 s x 3) aberta no último instante da vez cabe antes do fim do job;
    // e, com o limite pelo prazo (limiteDaChamada), nenhuma chamada da vez passa dele.
    expect(PRAZO_VEZ_CONVERSA_MS + TIMEOUT_IA_MS * (TENTATIVAS_EXTRAS_IA + 1)).toBeLessThan(EXPIRA_CONVERSA_SEGUNDOS * 1000);
  });
});

describe('tempo da chamada à IA (auditoria 4.16)', () => {
  it('150 s por tentativa (60 s cortava respostas longas), 2 tentativas extras', () => {
    expect(TIMEOUT_IA_MS).toBe(150_000);
    expect(TENTATIVAS_EXTRAS_IA).toBe(2);
  });

  it('limiteDaChamada: o que falta da vez limita cada tentativa e as tentativas extras; vencido, não chama', () => {
    expect(limiteDaChamada(undefined, 0)).toBeUndefined();
    expect(limiteDaChamada(10 * 60_000, 0)).toBeUndefined();
    expect(limiteDaChamada(400_000, 0)).toEqual({ timeoutMs: 150_000, maxRetries: 1 });
    expect(limiteDaChamada(200_000, 0)).toEqual({ timeoutMs: 150_000, maxRetries: 0 });
    expect(limiteDaChamada(90_000, 0)).toEqual({ timeoutMs: 90_000, maxRetries: 0 });
    expect(limiteDaChamada(1_000, 1_000)).toBeNull();
    // Nunca passa do prazo: tentativas x tempo de cada uma <= o que falta.
    for (const restante of [1, 5_000, 149_999, 150_000, 299_999, 300_000, 449_999]) {
      const l = limiteDaChamada(restante, 0)!;
      expect(l.timeoutMs * (l.maxRetries + 1)).toBeLessThanOrEqual(restante);
    }
  });

  it('a vez passa o limite à chamada; sem prazo, a chamada vai sem limite (os padrões do cliente)', async () => {
    const agora = 1_000_000;
    const real = Date.now;
    Date.now = () => agora;
    try {
      const { ia, rodar } = montar([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi!' } }), fim()], agora + 90_000);
      const opcoes: unknown[] = [];
      const original = ia.criar.bind(ia);
      ia.criar = (async (p: ParametrosIa, o?: unknown) => { opcoes.push(o); return original(p); }) as typeof ia.criar;
      expect(await rodar()).toEqual({ status: 'ok' });
      expect(opcoes[0]).toEqual({ limite: { timeoutMs: 90_000, maxRetries: 0 } });
      const sem = montar([usarFerramentas({ nome: 'responder', entrada: { texto: 'Oi!' } }), fim()], undefined);
      const opcoesSem: unknown[] = [];
      const originalSem = sem.ia.criar.bind(sem.ia);
      sem.ia.criar = (async (p: ParametrosIa, o?: unknown) => { opcoesSem.push(o); return originalSem(p); }) as typeof sem.ia.criar;
      await sem.rodar();
      expect(opcoesSem[0]).toBeUndefined();
    } finally {
      Date.now = real;
    }
  });
});
