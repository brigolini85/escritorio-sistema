import Anthropic from '@anthropic-ai/sdk';
import { SemI5, type GiroParaRodar, type Repos, type ReposRadar } from '@escritorio/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import * as avisos from '../../src/radar/avisos';
import { cicloRadar, enviosRadar, reiniciarAvisoSemI5, type DepsRadar } from '../../src/radar/ciclo';
import * as envios from '../../src/radar/envios';
import * as giro from '../../src/radar/giro';

vi.mock('../../src/radar/giro', () => ({ rodarGiro: vi.fn() }));
vi.mock('../../src/radar/avisos', () => ({ avisosDoGiro: vi.fn(async () => undefined) }));
vi.mock('../../src/radar/envios', () => ({ enviarEnvioRadar: vi.fn(async () => 'enviado') }));

const GIRO = { id: 'g1', origem: 'agenda', fontes: [{ id: 'f1' }, { id: 'f2' }] } as unknown as GiroParaRodar;
const FIM = { estado: 'concluido' as const, fontes: 2, paginas: 3, buscas: 1, fontesFora: [], lidas: [], resumo: 'ok', erro: null };

function montar(o: { giro?: GiroParaRodar | null; abrir?: () => Promise<void>; concluir?: () => Promise<void>; ids?: () => Promise<string[]> } = {}) {
  const radar = {
    abrirGirosRadar: vi.fn(o.abrir ?? (async () => undefined)),
    pegarGiroRadar: vi.fn(async () => (o.giro === undefined ? GIRO : o.giro)),
    concluirGiroRadar: vi.fn(o.concluir ?? (async () => undefined)),
    enviosRadarParaEnviar: vi.fn(o.ids ?? (async () => ['e1', 'e2', 'e3'])),
  };
  const d = { repos: {} as Repos, radar: radar as unknown as ReposRadar, ia: {} as never,
    envio: { repos: {} as Repos, canal: new CanalFalso(), limitador: new LimitadorEnvio(10), midia: {} as never }, relogio: () => new Date('2026-10-26T10:00:00Z') } satisfies DepsRadar;
  return { radar, d };
}

beforeEach(() => {
  vi.mocked(giro.rodarGiro).mockReset();
  vi.mocked(avisos.avisosDoGiro).mockClear();
  vi.mocked(envios.enviarEnvioRadar).mockReset().mockResolvedValue('enviado');
  reiniciarAvisoSemI5();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('ciclo do Radar (D5, D8, D19)', () => {
  it('sem a I5: não lança e avisa no log uma vez só', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const t = montar({ abrir: async () => { throw new SemI5(); } });
    await cicloRadar(t.d);
    await cicloRadar(t.d);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(giro.rodarGiro).not.toHaveBeenCalled();
  });

  it('sem giro: não roda', async () => {
    const t = montar({ giro: null });
    await cicloRadar(t.d);
    expect(giro.rodarGiro).not.toHaveBeenCalled();
    expect(t.radar.concluirGiroRadar).not.toHaveBeenCalled();
  });

  it('com giro: roda, conclui sem "novas" e avisa com as novas', async () => {
    vi.mocked(giro.rodarGiro).mockResolvedValue({ ...FIM, novas: ['n1', 'n2'] });
    const t = montar();
    await cicloRadar(t.d);
    expect(giro.rodarGiro).toHaveBeenCalledWith(t.d, GIRO);
    expect(t.radar.concluirGiroRadar).toHaveBeenCalledWith('g1', FIM);
    expect(avisos.avisosDoGiro).toHaveBeenCalledWith(t.d, 'g1', 'agenda', ['n1', 'n2']);
  });

  it('erro temporário da IA: giro falhou com a frase da casa; outro erro: mensagem curta; não lança', async () => {
    vi.mocked(giro.rodarGiro).mockRejectedValueOnce(new Anthropic.APIConnectionError({ message: 'sem rede' }));
    const t = montar();
    await cicloRadar(t.d);
    expect(t.radar.concluirGiroRadar).toHaveBeenCalledWith('g1', expect.objectContaining({ estado: 'falhou', erro: 'A IA não respondeu agora. O próximo giro tenta de novo.' }));
    vi.mocked(giro.rodarGiro).mockRejectedValueOnce(new Error('x'.repeat(300)));
    await cicloRadar(t.d);
    const chamadas = t.radar.concluirGiroRadar.mock.calls as unknown as [string, { erro: string }][];
    const erro = chamadas[1]![1].erro;
    expect(erro).toBe(`O giro falhou: ${'x'.repeat(200)}`);
    expect(chamadas[1]![1]).not.toHaveProperty('novas');
  });

  it('concluir falhando não derruba o ciclo', async () => {
    vi.mocked(giro.rodarGiro).mockResolvedValue({ ...FIM, novas: ['n1'] });
    const t = montar({ concluir: async () => { throw new Error('banco fora'); } });
    await expect(cicloRadar(t.d)).resolves.toBeUndefined();
    expect(avisos.avisosDoGiro).toHaveBeenCalled();
  });
});

describe('envios do Radar a cada minuto', () => {
  it('pede 20 e manda cada um; um que falha não impede os outros', async () => {
    vi.mocked(envios.enviarEnvioRadar).mockResolvedValueOnce('enviado').mockRejectedValueOnce(new Error('z-api')).mockResolvedValueOnce('enviado');
    const t = montar();
    expect(await enviosRadar(t.d)).toBe(2);
    expect(t.radar.enviosRadarParaEnviar).toHaveBeenCalledWith(20);
    expect(envios.enviarEnvioRadar).toHaveBeenCalledTimes(3);
  });

  it('SemI5: 0, sem lançar', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const t = montar({ ids: async () => { throw new SemI5(); } });
    expect(await enviosRadar(t.d)).toBe(0);
  });
});
