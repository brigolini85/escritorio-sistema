import { textoAvisoAlto, textoResumoDiario } from '@escritorio/core';
import type { Repos, ReposRadar } from '@escritorio/db';
import { describe, expect, it, vi } from 'vitest';
import { CanalFalso } from '../../src/canal/falso';
import { LimitadorEnvio } from '../../src/envio';
import { avisarDono, avisosDoGiro } from '../../src/radar/avisos';

const DONO = '5531988880000';
const ALTO = { whatsapp: true, avisoId: 'av1', titulo: 'eSocial muda o leiaute', fonte: 'eSocial', vigencia: '01/12/2026' };

function montar(o: { telefoneDono?: string | null; aviso?: (id: string) => unknown; resumo?: unknown } = {}) {
  const canal = new CanalFalso();
  const saidas: { autor: string; conteudo: string }[] = [];
  const repos = {
    obterConfiguracoes: vi.fn(async () => ({ telefoneDono: o.telefoneDono === undefined ? DONO : o.telefoneDono })),
    obterOuCriarConversa: vi.fn(async (telefone: string) => ({ id: 'conv-dono', telefone, estado: 'agente' })),
    criarSaidaPendente: vi.fn(async (m: { autor: string; conteudo: string }) => { saidas.push(m); return `msg${saidas.length}`; }),
    marcarEnviada: vi.fn(async () => undefined),
    marcarFalha: vi.fn(async () => undefined),
  };
  const radar = {
    avisarNovidadeNova: vi.fn(async (id: string) => (o.aviso ? o.aviso(id) : ALTO)),
    reservarResumoRadar: vi.fn(async () => o.resumo ?? null),
    marcarAvisoRadar: vi.fn(async () => undefined),
  };
  const envio = { repos: repos as unknown as Repos, canal, limitador: new LimitadorEnvio(100), midia: {} as never };
  const d = { repos: repos as unknown as Repos, radar: radar as unknown as ReposRadar, envio };
  return { canal, saidas, repos, radar, d };
}

describe('avisos do Radar ao dono (D13)', () => {
  it('sem telefone do dono: null e nada enviado', async () => {
    const t = montar({ telefoneDono: null });
    expect(await avisarDono(t.d, 'oi')).toBeNull();
    expect(t.canal.enviados).toEqual([]);
  });

  it('novidade de impacto alto: uma mensagem do sistema ao dono e marca o aviso; sem whatsapp, nada', async () => {
    const t = montar();
    await avisosDoGiro(t.d, 'g1', 'pedido', ['n1']);
    expect(t.canal.enviados).toEqual([{ telefone: DONO, texto: textoAvisoAlto({ titulo: ALTO.titulo, fonte: ALTO.fonte, vigencia: ALTO.vigencia }) }]);
    expect(t.saidas[0]!.autor).toBe('sistema');
    expect(t.radar.marcarAvisoRadar).toHaveBeenCalledWith('av1', 'msg1');
    const s = montar({ aviso: () => ({ ...ALTO, whatsapp: false, avisoId: null }) });
    await avisosDoGiro(s.d, 'g1', 'pedido', ['n1']);
    expect(s.canal.enviados).toEqual([]);
  });

  it('origem agenda: manda o resumo do dia; origem pedido: nem reserva o resumo', async () => {
    const resumo = { avisoId: 'av9', novidades: [{ titulo: 'A', impacto: 'alto', fonte: 'eSocial' }, { titulo: 'B', impacto: 'medio', fonte: 'CFC' }], fontesFora: ['CONFAZ'] };
    const t = montar({ resumo });
    await avisosDoGiro(t.d, 'g1', 'agenda', []);
    expect(t.canal.enviados).toEqual([{ telefone: DONO, texto: textoResumoDiario(resumo.novidades as never, resumo.fontesFora) }]);
    expect(t.radar.marcarAvisoRadar).toHaveBeenCalledWith('av9', 'msg1');
    const p = montar({ resumo });
    await avisosDoGiro(p.d, 'g1', 'pedido', []);
    expect(p.radar.reservarResumoRadar).not.toHaveBeenCalled();
    expect(p.canal.enviados).toEqual([]);
  });

  it('falha ao avisar uma novidade não impede a próxima', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const t = montar({ aviso: (id) => { if (id === 'n1') throw new Error('banco fora'); return ALTO; } });
    await avisosDoGiro(t.d, 'g1', 'pedido', ['n1', 'n2']);
    expect(t.canal.enviados).toHaveLength(1);
  });

  it('nenhuma mensagem vai a telefone que não seja o do dono', async () => {
    const resumo = { avisoId: 'av9', novidades: [{ titulo: 'A', impacto: 'alto', fonte: 'eSocial' }], fontesFora: [] };
    const t = montar({ resumo });
    await avisosDoGiro(t.d, 'g1', 'agenda', ['n1', 'n2']);
    expect(t.canal.enviados.length).toBe(3);
    expect(new Set(t.canal.enviados.map((e) => e.telefone))).toEqual(new Set([DONO]));
    expect(t.saidas.every((s) => s.autor === 'sistema')).toBe(true);
  });
});
